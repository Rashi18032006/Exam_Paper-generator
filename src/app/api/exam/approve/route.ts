import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

function formatExamToText(exam: any): string {
  let text = `==================================================\n`;
  text += `               ${exam.title?.toUpperCase() || "EXAM"}\n`;
  text += `               Total Marks: ${exam.totalMarks || 0}\n`;
  text += `==================================================\n\n`;

  if (exam.sections) {
    exam.sections.forEach((section: any) => {
      text += `--------------------------------------------------\n`;
      text += ` SECTION: ${section.name?.toUpperCase()}\n`;
      text += `--------------------------------------------------\n\n`;

      if (section.questions) {
        section.questions.forEach((q: any) => {
          text += `Q${q.qNo}. ${q.text} (${q.marks} Marks)\n`;
          if (q.options && q.options.length > 0) {
            q.options.forEach((opt: string, idx: number) => {
              text += `   [${String.fromCharCode(65 + idx)}] ${opt}\n`;
            });
          }
          if (q.starterCode) {
            text += `\nStarter Code:\n\`\`\`\n${q.starterCode}\n\`\`\`\n`;
          }
          if (q.solution) {
            text += `\nSolution:\n${q.solution}\n`;
          } else if (q.answerKey) {
            text += `\nAnswer Key: ${q.answerKey}\n`;
          }
          text += `\n`;
        });
      }
      text += `\n`;
    });
  }
  return text;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
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
      return NextResponse.json({ error: "No exam draft found for this session" }, { status: 404 });
    }

    // Update status to 'APPROVED'
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { status: "APPROVED" }
    });

    // Parse draft JSON and export it
    const draftJson = JSON.parse(latestDraft.draftJson);
    const formattedText = formatExamToText(draftJson);

    const exportsDir = path.join(process.cwd(), "public", "exports");
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filename = `exam-${sessionId}.txt`;
    const filepath = path.join(exportsDir, filename);
    fs.writeFileSync(filepath, formattedText, "utf8");

    const exportUrl = `/exports/${filename}`;

    return NextResponse.json({
      success: true,
      sessionId,
      exportUrl
    });

  } catch (error: any) {
    console.error("Approve route error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
