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
    const { sessionId, feedback } = await req.json();
    if (!sessionId || !feedback) {
      return NextResponse.json({ error: "Missing sessionId or feedback" }, { status: 400 });
    }

    const examSession = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        examDrafts: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    if (!examSession) {
      return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
    }

    const latestDraft = examSession.examDrafts[0];
    if (!latestDraft) {
      return NextResponse.json({ error: "No exam draft found to reject" }, { status: 404 });
    }

    // Limit revisions to 5
    if (examSession.iteration >= 5) {
      return NextResponse.json(
        {
          error: "Max revisions reached",
          draft: JSON.parse(latestDraft.draftJson)
        },
        { status: 400 }
      );
    }

    // Save feedback to the latest ExamDraft record
    await prisma.examDraft.update({
      where: { id: latestDraft.id },
      data: { professorFeedback: feedback }
    });

    // Reconstruct Graph State from the latest draft
    const prevDraft = JSON.parse(latestDraft.draftJson);

    const getSectionQuestions = (sectionName: string) => {
      const section = prevDraft.sections?.find((s: any) => s.name === sectionName);
      return section?.questions || [];
    };

    const agentAOutput = getSectionQuestions("Theory/Concept");
    const agentBOutput = getSectionQuestions("Programming/Coding");
    const agentCOutput = getSectionQuestions("Mathematics/Numerical");

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Re-running targets setup
          const targetMarksA = agentAOutput.reduce((sum: number, q: any) => sum + (q.marks || 0), 0);
          const targetMarksB = agentBOutput.reduce((sum: number, q: any) => sum + (q.marks || 0), 0);
          const targetMarksC = agentCOutput.reduce((sum: number, q: any) => sum + (q.marks || 0), 0);

          const resumeState = {
            input: {
              topic: examSession.topic,
              totalMarks: examSession.totalMarks,
              difficulty: examSession.difficulty
            },
            managerDistribution: {
              agentA: { marks: targetMarksA },
              agentB: { marks: targetMarksB },
              agentC: { marks: targetMarksC }
            },
            agentAOutput,
            agentBOutput,
            agentCOutput,
            editorOutput: prevDraft,
            humanFeedback: feedback,
            feedbackRouterTarget: null,
            iteration: examSession.iteration,
            status: "running" as const
          };

          // Update session status to GENERATING
          await prisma.examSession.update({
            where: { id: sessionId },
            data: { status: "GENERATING" }
          });

          // Run stream
          const graphStream = await examGraph.stream(resumeState);
          
          let accumulatedState: any = { ...resumeState };
          let targetsToRun: string[] = [];
          let hasEditorStarted = false;

          for await (const chunk of graphStream) {
            const nodeName = Object.keys(chunk)[0];
            const nodeState = (chunk as any)[nodeName];
            accumulatedState = { ...accumulatedState, ...nodeState };

            if (nodeName === "feedbackRouter") {
              targetsToRun = nodeState.feedbackRouterTarget || [];
              
              // Broadcast started event for the targeted worker agents
              targetsToRun.forEach((agent: string) => {
                sendEvent({ type: "agent_status", agent, status: "started", progress: 20 });
              });
            }

            if (nodeName === "agentA") {
              sendEvent({ type: "agent_status", agent: "agentA", status: "complete", progress: 60 });
            } else if (nodeName === "agentB") {
              sendEvent({ type: "agent_status", agent: "agentB", status: "complete", progress: 60 });
            } else if (nodeName === "agentC") {
              sendEvent({ type: "agent_status", agent: "agentC", status: "complete", progress: 60 });
            }

            if (targetsToRun.length > 0 && !hasEditorStarted) {
              const allFinished = targetsToRun.every((agent: string) => {
                if (agent === "agentA") return accumulatedState.agentAOutput !== null;
                if (agent === "agentB") return accumulatedState.agentBOutput !== null;
                if (agent === "agentC") return accumulatedState.agentCOutput !== null;
                return true;
              });

              if (allFinished) {
                hasEditorStarted = true;
                sendEvent({ type: "agent_status", agent: "editor", status: "started", progress: 80 });
              }
            }

            if (nodeName === "editor") {
              const editorResult = nodeState.editorOutput;
              if (editorResult && "error" in editorResult) {
                sendEvent({ type: "error", message: editorResult.error });
                
                await prisma.examSession.update({
                  where: { id: sessionId },
                  data: { status: "REJECTED" }
                });
                
                controller.close();
                return;
              }
              sendEvent({ type: "agent_status", agent: "editor", status: "complete", progress: 95 });
            }
          }

          const finalDraft = accumulatedState.editorOutput;
          const finalIteration = accumulatedState.iteration ?? (examSession.iteration + 1);

          // Update ExamSession with status 'AWAITING_REVIEW' and the new iteration counter
          await prisma.examSession.update({
            where: { id: sessionId },
            data: {
              status: "AWAITING_REVIEW",
              iteration: finalIteration
            }
          });

          // Create new ExamDraft record
          await prisma.examDraft.create({
            data: {
              sessionId,
              draftJson: JSON.stringify(finalDraft)
            }
          });

          // Emit draft_ready SSE event
          sendEvent({ type: "draft_ready", sessionId, draft: finalDraft });
          controller.close();

        } catch (error: any) {
          console.error("Error during graph resume stream:", error);
          sendEvent({ type: "error", message: error.message || "An unexpected error occurred while processing feedback." });
          
          await prisma.examSession.update({
            where: { id: sessionId },
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
    console.error("Reject route error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
