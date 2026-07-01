import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const sessions = await prisma.examSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        examDrafts: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    // Map sessions to include a direct reference to the latest draft
    const formattedSessions = sessions.map(session => {
      const latestDraft = session.examDrafts[0] || null;
      return {
        id: session.id,
        userId: session.userId,
        topic: session.topic,
        totalMarks: session.totalMarks,
        difficulty: session.difficulty,
        status: session.status,
        iteration: session.iteration,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        latestDraft
      };
    });

    return NextResponse.json({ sessions: formattedSessions });

  } catch (error: any) {
    console.error("Dashboard GET error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
