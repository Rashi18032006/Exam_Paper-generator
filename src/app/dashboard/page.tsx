"use client";

import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ExamSession {
  id: string;
  topic: string;
  totalMarks: number;
  numQuestions: number;
  difficulty: string;
  status: "GENERATING" | "AWAITING_REVIEW" | "APPROVED" | "REJECTED";
  iteration: number;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/dashboard")
        .then((res) => res.json())
        .then((data) => {
          if (data.sessions) {
            setSessions(data.sessions);
          }
        })
        .catch((err) => console.error("Error fetching sessions:", err))
        .finally(() => setLoadingData(false));
    }
  }, [status]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="loader-container">
        <style jsx>{`
          .loader-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: var(--bg-primary);
            color: var(--text-muted);
            font-family: var(--font-sans);
          }
        `}</style>
        <div>Checking credentials...</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "GENERATING":
        return "#FFC400"; // Gold
      case "AWAITING_REVIEW":
        return "var(--accent-cyan)"; // Cyan
      case "APPROVED":
        return "var(--color-approve)"; // Green
      case "REJECTED":
        return "var(--color-reject)"; // Red
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <div className="dashboard-container">
      <style jsx>{`
        .dashboard-container {
          min-height: 100vh;
          color: var(--text-primary);
          display: flex;
          flex-direction: column;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 40px;
          background-color: var(--bg-surface);
          border-bottom: 1px solid var(--border-default);
          backdrop-filter: var(--backdrop-blur);
        }
        .logo {
          font-weight: 800;
          font-size: 24px;
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .user-nav {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .user-name {
          font-size: 14px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .signout-btn {
          padding: 8px 18px;
          border-radius: var(--radius-md);
          background-color: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .signout-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
          border-color: var(--text-muted);
        }
        .main-content {
          flex: 1;
          padding: 40px;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .actions-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .title {
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .new-exam-btn {
          padding: 14px 28px;
          border-radius: var(--radius-md);
          background: var(--gradient-primary);
          color: var(--bg-primary);
          font-weight: 800;
          font-size: 14px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 15px rgba(181, 0, 255, 0.25);
        }
        .new-exam-btn:hover {
          background: var(--gradient-hover);
          box-shadow: 0 4px 20px rgba(0, 240, 255, 0.35);
        }
        .sessions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }
        .card {
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .card-topic {
          font-size: 19px;
          font-weight: 700;
          line-height: 1.4;
          color: var(--text-primary);
        }
        .badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .card-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          font-size: 13px;
          color: var(--text-muted);
          border-top: 1px solid var(--border-default);
          border-bottom: 1px solid var(--border-default);
          padding: 12px 0;
        }
        .detail-item strong {
          color: var(--text-primary);
        }
        .view-btn {
          padding: 12px;
          border-radius: var(--radius-md);
          background-color: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          transition: all 0.2s ease;
        }
        .view-btn:hover {
          background-color: var(--accent-cyan-dim);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          text-shadow: 0 0 10px rgba(0, 240, 255, 0.1);
        }
        .empty-state {
          text-align: center;
          padding: 80px 20px;
          border: 2px dashed var(--border-default);
          border-radius: var(--radius-lg);
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .skeleton-card {
          height: 220px;
          border-radius: var(--radius-lg);
          position: relative;
          overflow: hidden;
        }
        .skeleton-card::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.03),
            transparent
          );
          animation: loading-sweep 1.6s infinite;
        }
        @keyframes loading-sweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>

      {/* Header Navigation */}
      <header className="header">
        <div className="logo">Auto-TA</div>
        <div className="user-nav">
          <span className="user-name">Welcome, {session?.user?.name || "Professor"}</span>
          <button className="signout-btn" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="actions-bar">
          <h1 className="title">Exam Dashboard</h1>
          <Link href="/exam/new" className="new-exam-btn">
            <span>+ Generate New Exam</span>
          </Link>
        </div>

        {loadingData ? (
          /* Loading skeleton Loader */
          <div className="sessions-grid">
            <div className="skeleton-card glass-panel" />
            <div className="skeleton-card glass-panel" />
            <div className="skeleton-card glass-panel" />
          </div>
        ) : sessions.length === 0 ? (
          /* Empty State */
          <div className="empty-state">
            <p>No exams generated yet. Start by defining your first assessment details.</p>
            <div style={{ alignSelf: "center" }}>
              <Link href="/exam/new" className="new-exam-btn">
                <span>+ Create Your First Exam</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Sessions list grid */
          <div className="sessions-grid">
            {sessions.map((session) => (
              <div key={session.id} className="card glass-panel hover-grow">
                <div className="card-header">
                  <h3 className="card-topic">{session.topic}</h3>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: `${getStatusColor(session.status)}12`,
                      color: getStatusColor(session.status),
                      border: `1px solid ${getStatusColor(session.status)}25`,
                    }}
                  >
                    {session.status.replace("_", " ")}
                  </span>
                </div>

                <div className="card-details">
                  <div className="detail-item">
                    Budget: <strong>{session.totalMarks} Marks</strong>
                  </div>
                  <div className="detail-item">
                    Questions: <strong>{session.numQuestions} Q</strong>
                  </div>
                  <div className="detail-item">
                    Difficulty: <strong>{session.difficulty}</strong>
                  </div>
                  <div className="detail-item">
                    Revision: <strong>{session.iteration} of 5</strong>
                  </div>
                </div>

                <Link href={`/exam/${session.id}`} className="view-btn">
                  View Workflow
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
export const dynamic = "force-dynamic";
