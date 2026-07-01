import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
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
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      session: {
        id: examSession.id,
        topic: examSession.topic,
        totalMarks: examSession.totalMarks,
        numQuestions: examSession.numQuestions,
        difficulty: examSession.difficulty,
        status: examSession.status,
        iteration: examSession.iteration,
        createdAt: examSession.createdAt
      },
      latestDraft: examSession.examDrafts[0] || null
    });
  } catch (err: any) {
    console.error("GET details error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
