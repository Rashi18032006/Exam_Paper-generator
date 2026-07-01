import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { examGraph } from "@/lib/agent/examGraph";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { topic, totalMarks, difficulty, distribution, sessionId, numQuestions } = await req.json();
    if (!topic || !totalMarks || !difficulty) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let examSession;
    if (sessionId) {
      examSession = await prisma.examSession.findUnique({
        where: { id: sessionId }
      });
      if (!examSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      examSession = await prisma.examSession.update({
        where: { id: sessionId },
        data: { status: "GENERATING" }
      });
    } else {
      examSession = await prisma.examSession.create({
        data: {
          userId: user.id,
          topic,
          totalMarks: Number(totalMarks),
          numQuestions: Number(numQuestions || 10),
          difficulty,
          status: "GENERATING"
        }
      });
    }

    // Check if the client wants a JSON response for initialization
    const acceptHeader = req.headers.get("accept");
    if (acceptHeader?.includes("application/json")) {
      return NextResponse.json({ sessionId: examSession.id });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const initialState = {
            input: {
              topic: examSession.topic,
              totalMarks: Number(examSession.totalMarks),
              difficulty: examSession.difficulty,
              numQuestions: Number(examSession.numQuestions || 10),
              distribution
            }
          };

          // Stream graph events
          const graphStream = await examGraph.stream(initialState);
          
          // Emit started status for all three parallel agents
          sendEvent({ type: "agent_status", agent: "agentA", status: "started", progress: 10 });
          sendEvent({ type: "agent_status", agent: "agentB", status: "started", progress: 10 });
          sendEvent({ type: "agent_status", agent: "agentC", status: "started", progress: 10 });

          let accumulatedState: any = { ...initialState };

          let hasACompleted = false;
          let hasBCompleted = false;
          let hasCCompleted = false;
          let hasEditorStarted = false;

          for await (const chunk of graphStream) {
            const nodeName = Object.keys(chunk)[0];
            const nodeState = (chunk as any)[nodeName];
            accumulatedState = { ...accumulatedState, ...nodeState };

            if (nodeName === "agentA") {
              hasACompleted = true;
              sendEvent({ type: "agent_status", agent: "agentA", status: "complete", progress: 40 });
            } else if (nodeName === "agentB") {
              hasBCompleted = true;
              sendEvent({ type: "agent_status", agent: "agentB", status: "complete", progress: 40 });
            } else if (nodeName === "agentC") {
              hasCCompleted = true;
              sendEvent({ type: "agent_status", agent: "agentC", status: "complete", progress: 40 });
            }

            // If all worker agents have completed but editor has not started, trigger editor started status
            if (hasACompleted && hasBCompleted && hasCCompleted && !hasEditorStarted) {
              hasEditorStarted = true;
              sendEvent({ type: "agent_status", agent: "editor", status: "started", progress: 70 });
            }

            if (nodeName === "editor") {
              const editorResult = nodeState.editorOutput;
              if (editorResult && "error" in editorResult) {
                sendEvent({ type: "error", message: editorResult.error });
                
                await prisma.examSession.update({
                  where: { id: examSession.id },
                  data: { status: "REJECTED" }
                });
                
                controller.close();
                return;
              }
              sendEvent({ type: "agent_status", agent: "editor", status: "complete", progress: 95 });
            }
          }

          const draft = accumulatedState.editorOutput;

          // Update ExamSession status to 'AWAITING_REVIEW'
          await prisma.examSession.update({
            where: { id: examSession.id },
            data: { status: "AWAITING_REVIEW" }
          });

          // Save draft JSON to ExamDraft table
          await prisma.examDraft.create({
            data: {
              sessionId: examSession.id,
              draftJson: JSON.stringify(draft)
            }
          });

          // Emit draft_ready
          sendEvent({ type: "draft_ready", sessionId: examSession.id, draft });
          controller.close();

        } catch (error: any) {
          console.error("Error during graph stream:", error);
          sendEvent({ type: "error", message: error.message || "An unexpected error occurred during exam generation." });
          
          await prisma.examSession.update({
            where: { id: examSession.id },
            data: { status: "REJECTED" }
          }).catch(console.error);

          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });

  } catch (error: any) {
    console.error("Exam generation initialization error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
