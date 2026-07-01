"use client";

import React, { use, useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AgentOrchestrator } from "@/components/AgentOrchestrator";
import { CheckpointPanel } from "@/components/CheckpointPanel";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

interface AgentState {
  status: "waiting" | "active" | "complete";
  progress: number;
}

export default function ExamSessionPage({ params }: PageProps) {
  const { sessionId } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Page workflow status: 'loading' | 'generating' | 'review' | 'approved' | 'error'
  const [status, setStatus] = useState<"loading" | "generating" | "review" | "approved" | "error">("loading");
  
  // Topic metadata
  const [topic, setTopic] = useState("");
  const [totalMarks, setTotalMarks] = useState(0);
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState("");
  const [iteration, setIteration] = useState(0);

  // Agent progress states
  const [agentA, setAgentA] = useState<AgentState>({ status: "waiting", progress: 0 });
  const [agentB, setAgentB] = useState<AgentState>({ status: "waiting", progress: 0 });
  const [agentC, setAgentC] = useState<AgentState>({ status: "waiting", progress: 0 });
  const [editor, setEditor] = useState<AgentState>({ status: "waiting", progress: 0 });

  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generationStarted = useRef(false);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [authStatus, router]);

  // Read agent status updates from SSE streams
  const handleAgentStatusUpdate = useCallback((agent: string, statusVal: string, progress: number) => {
    const stateVal = statusVal as "waiting" | "active" | "complete";
    if (agent === "agentA") setAgentA({ status: stateVal, progress });
    else if (agent === "agentB") setAgentB({ status: stateVal, progress });
    else if (agent === "agentC") setAgentC({ status: stateVal, progress });
    else if (agent === "editor") setEditor({ status: stateVal, progress });
  }, []);

  // Streaming generator handler
  const executeGeneration = useCallback(async () => {
    setStatus("generating");
    setAgentA({ status: "active", progress: 10 });
    setAgentB({ status: "active", progress: 10 });
    setAgentC({ status: "active", progress: 10 });
    setEditor({ status: "waiting", progress: 0 });
    setError(null);

    try {
      const response = await fetch("/api/exam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          topic: searchParams.get("topic") || topic,
          totalMarks: Number(searchParams.get("totalMarks") || totalMarks),
          numQuestions: Number(searchParams.get("numQuestions") || numQuestions || 10),
          difficulty: searchParams.get("difficulty") || difficulty,
          distribution: {
            theory: Number(searchParams.get("theory") || 40),
            code: Number(searchParams.get("code") || 35),
            math: Number(searchParams.get("math") || 25)
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate exam draft");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Failed to initialize SSE reader stream");

      let accumulatedText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulatedText += decoder.decode(value, { stream: true });
        const lines = accumulatedText.split("\n");
        accumulatedText = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (!dataStr) continue;

            const event = JSON.parse(dataStr);
            if (event.type === "agent_status") {
              handleAgentStatusUpdate(event.agent, event.status, event.progress);
            } else if (event.type === "draft_ready") {
              setDraft(event.draft);
              setStatus("review");
              setIteration(1);
              return;
            } else if (event.type === "error") {
              setError(event.message);
              setStatus("error");
              return;
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during generation.");
      setStatus("error");
    }
  }, [sessionId, searchParams, topic, totalMarks, numQuestions, difficulty, handleAgentStatusUpdate]);

  // Load past session details or trigger generation on mount
  useEffect(() => {
    if (authStatus === "authenticated") {
      const isGenerateMode = searchParams.get("generate") === "true";

      if (isGenerateMode) {
        if (generationStarted.current) return;
        generationStarted.current = true;

        // Read details from query parameters and start generation
        setTopic(searchParams.get("topic") || "");
        setTotalMarks(Number(searchParams.get("totalMarks") || 0));
        setNumQuestions(Number(searchParams.get("numQuestions") || 10));
        setDifficulty(searchParams.get("difficulty") || "");
        executeGeneration();
      } else {
        // Load details from the database details endpoint
        fetch(`/api/exam/details?sessionId=${sessionId}`)
          .then((res) => {
            if (!res.ok) throw new Error("Failed to load details");
            return res.json();
          })
          .then((data) => {
            setTopic(data.session.topic);
            setTotalMarks(data.session.totalMarks);
            setNumQuestions(data.session.numQuestions);
            setDifficulty(data.session.difficulty);
            setIteration(data.session.iteration);

            if (data.session.status === "APPROVED") {
              setDraft(JSON.parse(data.latestDraft.draftJson));
              setExportUrl(`/exports/exam-${sessionId}.txt`);
              setStatus("approved");
            } else if (data.session.status === "AWAITING_REVIEW" && data.latestDraft) {
              setDraft(JSON.parse(data.latestDraft.draftJson));
              setStatus("review");
            } else if (data.session.status === "GENERATING") {
              if (generationStarted.current) return;
              generationStarted.current = true;
              // Re-run generation if aborted previously
              executeGeneration();
            } else {
              setError("This session is in an invalid state.");
              setStatus("error");
            }
          })
          .catch((err) => {
            setError(err.message || "Could not retrieve exam session details.");
            setStatus("error");
          });
      }
    }
  }, [authStatus, sessionId, searchParams, executeGeneration]);

  // Copy Exam Text helper
  const handleCopyText = () => {
    if (!draft) return;

    let text = `==================================================\n`;
    text += `               ${draft.title?.toUpperCase()}\n`;
    text += `               Total Marks: ${draft.totalMarks} | Total Questions: ${numQuestions}\n`;
    text += `==================================================\n\n`;

    draft.sections?.forEach((section: any) => {
      text += `SECTION: ${section.name.toUpperCase()}\n\n`;
      section.questions?.forEach((q: any) => {
        text += `Q${q.qNo}. ${q.text} (${q.marks} Marks)\n`;
        if (q.options) {
          q.options.forEach((opt: string, i: number) => {
            text += `  [${String.fromCharCode(65 + i)}] ${opt}\n`;
          });
        }
        if (q.starterCode) {
          text += `Starter Code:\n${q.starterCode}\n`;
        }
        text += `\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDifficultyLabel = (diff: string) => {
    return diff?.toUpperCase() || "MEDIUM";
  };

  if (authStatus === "loading" || status === "loading") {
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
        <div>Loading workflow session...</div>
      </div>
    );
  }

  return (
    <div className="session-page">
      <style jsx>{`
        .session-page {
          min-height: 100vh;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-family: var(--font-sans);
          display: flex;
          flex-direction: column;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 40px;
          border-bottom: 1px solid var(--border-default);
          background-color: var(--bg-surface);
          backdrop-filter: var(--backdrop-blur);
        }
        .logo-group {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .logo {
          font-weight: 800;
          font-size: 24px;
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-decoration: none;
        }
        .nav-back {
          font-size: 13px;
          color: var(--text-muted);
          text-decoration: none;
          font-weight: 600;
        }
        .nav-back:hover {
          color: var(--accent-cyan);
        }
        .metadata-pill {
          display: flex;
          gap: 12px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .pill-item {
          background-color: rgba(255, 255, 255, 0.03);
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid var(--border-default);
        }
        .main-layout {
          flex: 1;
          padding: 40px;
          max-width: 1000px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .approved-card {
          border-radius: var(--radius-lg);
          padding: 56px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }
        .approved-icon {
          font-size: 64px;
          animation: scale-up 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          filter: drop-shadow(0 0 15px rgba(0, 230, 118, 0.4));
        }
        .approved-title {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #00E676 0%, #00b0ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .approved-desc {
          color: var(--text-muted);
          font-size: 15px;
          max-width: 480px;
          line-height: 1.6;
        }
        .action-row {
          display: flex;
          gap: 16px;
          width: 100%;
          justify-content: center;
          margin-top: 12px;
        }
        .btn {
          padding: 14px 28px;
          border-radius: var(--radius-md);
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn:active {
          transform: scale(0.97);
        }
        .btn-primary {
          background: var(--gradient-primary);
          color: var(--bg-primary);
          border: none;
          box-shadow: 0 4px 15px rgba(181, 0, 255, 0.25);
        }
        .btn-primary:hover {
          background: var(--gradient-hover);
          box-shadow: 0 4px 20px rgba(0, 240, 255, 0.35);
        }
        .btn-secondary {
          background-color: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
        }
        .btn-secondary:hover {
          background-color: rgba(255, 255, 255, 0.08);
          border-color: var(--text-muted);
        }
        .btn-dashboard {
          margin-top: 24px;
          background-color: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-default);
          color: var(--text-muted);
        }
        .btn-dashboard:hover {
          color: var(--text-primary);
          border-color: var(--text-muted);
        }
        .error-card {
          border-radius: var(--radius-lg);
          padding: 40px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          border: 1px solid rgba(255, 23, 68, 0.25);
        }
        .error-title {
          font-size: 22px;
          font-weight: 800;
          color: var(--color-reject);
        }
        .error-text {
          font-size: 14px;
          color: var(--text-muted);
          max-width: 480px;
          line-height: 1.5;
        }
        @keyframes scale-up {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>

      {/* Header Bar */}
      <header className="header">
        <div className="logo-group">
          <Link href="/dashboard" className="logo">Auto-TA</Link>
          <span style={{ color: "var(--border-default)" }}>|</span>
          <Link href="/dashboard" className="nav-back">← Dashboard</Link>
        </div>
        <div className="metadata-pill">
          <div className="pill-item">Topic: <strong>{topic}</strong></div>
          <div className="pill-item">Target: <strong>{totalMarks} Marks / {numQuestions} Questions</strong></div>
          <div className="pill-item">Difficulty: <strong>{getDifficultyLabel(difficulty)}</strong></div>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-layout">
        {status === "generating" && (
          <AgentOrchestrator
            agentA={agentA}
            agentB={agentB}
            agentC={agentC}
            editor={editor}
            error={error}
          />
        )}

        {status === "review" && draft && (
          <CheckpointPanel
            draft={draft}
            iteration={iteration || 1}
            sessionId={sessionId}
            onApprove={(url) => {
              setExportUrl(url);
              setStatus("approved");
            }}
            onRejectStart={() => {
              setStatus("generating");
              setAgentA({ status: "waiting", progress: 0 });
              setAgentB({ status: "waiting", progress: 0 });
              setAgentC({ status: "waiting", progress: 0 });
              setEditor({ status: "waiting", progress: 0 });
              setError(null);
            }}
            onRejectComplete={(newDraft, newIteration) => {
              setDraft(newDraft);
              setIteration(newIteration);
              setStatus("review");
            }}
            onRejectError={(msg) => {
              setError(msg);
              setStatus("error");
            }}
            onAgentStatusUpdate={handleAgentStatusUpdate}
          />
        )}

        {status === "approved" && (
          <div className="approved-card glass-panel">
            <div className="approved-icon">🏆</div>
            <h1 className="approved-title">Exam Approved!</h1>
            <p className="approved-desc">
              Your assessment has been compiled and saved. Download the formatted text or copy it directly.
            </p>
            
            <div className="action-row">
              <button className="btn btn-secondary" onClick={handleCopyText}>
                {copied ? "Copied!" : "Copy Exam Text"}
              </button>
              {exportUrl && (
                <a href={exportUrl} download className="btn btn-primary">
                  Download Exam File (.txt)
                </a>
              )}
            </div>

            <Link href="/dashboard" className="btn btn-dashboard">
              Back to Dashboard
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="error-card glass-panel">
            <div className="error-title">Generation Error</div>
            <p className="error-text">
              {error || "An unexpected error occurred during execution."}
            </p>
            <button className="btn btn-primary" onClick={executeGeneration}>
              Retry Agent Generation
            </button>
            <Link href="/dashboard" className="btn btn-dashboard" style={{ marginTop: "12px" }}>
              Return to Dashboard
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
export const dynamic = "force-dynamic";
