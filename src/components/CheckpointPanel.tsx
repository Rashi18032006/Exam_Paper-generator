"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CompiledQuestion {
  qNo: number;
  type: string;
  text: string;
  marks: number;
  options?: string[];
  answerKey: string;
  latex?: string;
  starterCode?: string;
  solution?: string;
}

interface CompiledExamSection {
  name: string;
  questions: CompiledQuestion[];
}

interface CompiledExam {
  title: string;
  sections: CompiledExamSection[];
  totalMarks: number;
}

interface CheckpointPanelProps {
  draft: CompiledExam;
  iteration: number;
  sessionId: string;
  onApprove: (exportUrl: string) => void;
  onRejectStart: () => void;
  onRejectComplete: (newDraft: CompiledExam, newIteration: number) => void;
  onRejectError: (errorMessage: string) => void;
  onAgentStatusUpdate: (agent: string, status: "waiting" | "active" | "complete", progress: number) => void;
}

export function CheckpointPanel({
  draft,
  iteration,
  sessionId,
  onApprove,
  onRejectStart,
  onRejectComplete,
  onRejectError,
  onAgentStatusUpdate,
}: CheckpointPanelProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);

  // Tab state: 'paper' (Clean Question Paper) or 'answers' (Answer Key & Marking Scheme)
  const [activeTab, setActiveTab] = useState<"paper" | "answers">("paper");

  // Calculate statistics
  const totalQuestions = draft.sections?.reduce((sum, s) => sum + (s.questions?.length || 0), 0) || 0;
  const avgMarks = totalQuestions > 0 ? (draft.totalMarks / totalQuestions).toFixed(1) : "0";

  // Calculate section markings
  const sectionBreakdown = draft.sections?.map(s => {
    const marks = s.questions?.reduce((sum, q) => sum + (q.marks || 0), 0) || 0;
    return { name: s.name, marks };
  }) || [];

  const handleApprove = async () => {
    setApproving(true);
    try {
      const response = await fetch("/api/exam/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to approve exam");
      }
      onApprove(data.exportUrl || `/exports/exam-${sessionId}.txt`);
    } catch (err: any) {
      alert(err.message || "Approval failed.");
    } finally {
      setApproving(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setSubmitting(true);
    onRejectStart(); // Tell parent we are generating

    try {
      const response = await fetch("/api/exam/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, feedback })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Revision cycle failed.");
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("SSE Stream connection failed.");

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
              onAgentStatusUpdate(event.agent, event.status, event.progress);
            } else if (event.type === "draft_ready") {
              onRejectComplete(event.draft, event.draft.iteration ?? (iteration + 1));
              setFeedback("");
              setShowFeedback(false);
              setSubmitting(false);
              return;
            } else if (event.type === "error") {
              onRejectError(event.message);
              setSubmitting(false);
              return;
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      onRejectError(err.message || "An error occurred during revision.");
      setSubmitting(false);
    }
  };

  const getSectionBorderColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("theory") || n.includes("concept")) return "var(--accent-cyan)";
    if (n.includes("code") || n.includes("program")) return "var(--color-warning)";
    return "var(--accent-purple)";
  };

  return (
    <div className="checkpoint-wrapper">
      <style jsx>{`
        .checkpoint-wrapper {
          display: flex;
          flex-direction: column;
          gap: 28px;
          width: 100%;
        }
        
        /* Stats Dashboard Panel */
        .stats-dashboard {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 768px) {
          .stats-dashboard {
            grid-template-columns: 1fr 1fr;
          }
        }
        .stat-card {
          padding: 16px 20px;
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .stat-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 0.5px;
        }
        .stat-value {
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
          font-family: var(--font-sans);
        }
        .stat-meta {
          font-size: 11px;
          color: var(--text-muted);
        }

        /* Tabs Navigation bar */
        .tabs-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          border-bottom: 1px solid var(--border-default);
          padding-bottom: 8px;
        }
        @media (max-width: 600px) {
          .tabs-header-bar {
            flex-direction: column;
            align-items: flex-start;
          }
        }
        .tabs-container {
          display: flex;
          background-color: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-default);
          padding: 4px;
          border-radius: 30px;
        }
        .tab-btn {
          padding: 8px 18px;
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border-radius: 20px;
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          color: var(--text-primary);
        }
        .tab-btn.active {
          background: var(--gradient-primary);
          color: var(--bg-primary);
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
        }
        .revision-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--accent-cyan);
          background-color: var(--accent-cyan-dim);
          border: 1px solid rgba(0, 240, 255, 0.15);
          padding: 6px 14px;
          border-radius: 20px;
        }

        /* Preview container */
        .preview-pane {
          border-radius: var(--radius-lg);
          padding: 40px;
          max-height: 600px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 36px;
        }
        .exam-title {
          font-size: 26px;
          font-weight: 800;
          text-align: center;
          margin-bottom: 8px;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }
        .section-block {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .section-header {
          font-size: 15px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding-left: 12px;
          margin-bottom: 4px;
        }
        .question-item {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--border-default);
        }
        .question-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .q-header {
          display: flex;
          justify-content: space-between;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.5;
        }
        .q-tag {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          background-color: var(--bg-elevated);
          margin-right: 8px;
          color: var(--accent-cyan);
          border: 1px solid var(--border-default);
        }
        .q-text {
          flex: 1;
          padding-right: 20px;
        }
        .q-marks {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 600;
          flex-shrink: 0;
        }
        .options-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding-left: 20px;
        }
        @media (max-width: 600px) {
          .options-list {
            grid-template-columns: 1fr;
          }
        }
        .option-item {
          font-size: 14px;
          color: var(--text-muted);
          background-color: rgba(0, 0, 0, 0.15);
          padding: 10px 14px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
        }
        .code-block {
          background-color: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 14px;
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--text-primary);
          white-space: pre-wrap;
          overflow-x: auto;
          margin-top: 4px;
        }
        .solution-box {
          font-size: 13px;
          color: var(--text-primary);
          background-color: rgba(0, 230, 118, 0.04);
          padding: 14px 18px;
          border-radius: var(--radius-md);
          margin-top: 6px;
          border-left: 3px solid var(--color-approve);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .latex-code {
          font-family: var(--font-mono);
          color: var(--accent-cyan);
          background-color: rgba(0, 0, 0, 0.2);
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-default);
          display: inline-block;
          margin-top: 4px;
        }

        /* Action Buttons */
        .action-footer {
          display: flex;
          justify-content: flex-end;
          gap: 16px;
          border-top: 1px solid var(--border-default);
          padding-top: 24px;
        }
        .btn {
          padding: 14px 30px;
          border-radius: var(--radius-md);
          border: none;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn:active {
          transform: scale(0.97);
        }
        .btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .approve-btn {
          background-color: var(--color-approve);
          color: var(--bg-primary);
          box-shadow: 0 4px 15px rgba(0, 230, 118, 0.2);
        }
        .approve-btn:hover:not(:disabled) {
          box-shadow: 0 4px 20px rgba(0, 230, 118, 0.4);
        }
        .reject-btn {
          background-color: var(--color-reject);
          color: var(--text-primary);
          box-shadow: 0 4px 15px rgba(255, 23, 68, 0.15);
        }
        .reject-btn:hover:not(:disabled) {
          box-shadow: 0 4px 20px rgba(255, 23, 68, 0.3);
        }
        .feedback-panel {
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .feedback-textarea {
          width: 100%;
          min-height: 100px;
          padding: 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-default);
          background-color: rgba(0, 0, 0, 0.2);
          color: var(--text-primary);
          font-family: var(--font-sans);
          font-size: 14px;
          outline: none;
          resize: vertical;
        }
        .feedback-textarea:focus {
          border-color: var(--accent-cyan);
          box-shadow: 0 0 0 2px var(--accent-cyan-dim);
        }
        .feedback-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .feedback-submit {
          background: var(--gradient-primary);
          color: var(--bg-primary);
          font-weight: 800;
          box-shadow: 0 4px 12px rgba(181, 0, 255, 0.25);
        }
        .feedback-submit:hover:not(:disabled) {
          background: var(--gradient-hover);
          box-shadow: 0 4px 18px rgba(0, 240, 255, 0.35);
        }
        .feedback-cancel {
          background-color: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
        }
        .feedback-cancel:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }
      `}</style>

      {/* Stats Dashboard Grid */}
      <div className="stats-dashboard">
        <div className="stat-card glass-panel">
          <span className="stat-label">Total Marks</span>
          <span className="stat-value">{draft.totalMarks}M</span>
          <span className="stat-meta">Allocated budget</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-label">Questions</span>
          <span className="stat-value">{totalQuestions}Q</span>
          <span className="stat-meta">Active indices count</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-label">Average Weight</span>
          <span className="stat-value">{avgMarks}M</span>
          <span className="stat-meta">Marks per question</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-label">Section Ratio</span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
            {sectionBreakdown.map((sec, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: getSectionBorderColor(sec.name),
                  backgroundColor: `${getSectionBorderColor(sec.name)}12`,
                  border: `1px solid ${getSectionBorderColor(sec.name)}25`,
                  padding: "2px 6px",
                  borderRadius: "4px"
                }}
              >
                {sec.marks}M
              </span>
            ))}
          </div>
          <span className="stat-meta" style={{ marginTop: "auto", display: "block" }}>Section scoring split</span>
        </div>
      </div>

      {/* Tab Switcher Headers */}
      <div className="tabs-header-bar">
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === "paper" ? "active" : ""}`}
            onClick={() => setActiveTab("paper")}
          >
            📄 Question Paper
          </button>
          <button
            className={`tab-btn ${activeTab === "answers" ? "active" : ""}`}
            onClick={() => setActiveTab("answers")}
          >
            🔑 Answer Key & Rubrics
          </button>
        </div>
        <span className="revision-label">Revision {iteration} of 5</span>
      </div>

      {/* Exam Preview Pane (Collapsible sheet) */}
      <div className="preview-pane glass-panel">
        <h1 className="exam-title">{draft.title}</h1>

        {draft.sections?.map((section, sIdx) => (
          <div key={sIdx} className="section-block">
            <h3
              className="section-header"
              style={{
                color: getSectionBorderColor(section.name),
                borderLeft: `3px solid ${getSectionBorderColor(section.name)}`
              }}
            >
              {section.name}
            </h3>
            {section.questions?.map((q, qIdx) => (
              <div key={qIdx} className="question-item">
                <div className="q-header">
                  <span className="q-text">
                    <span className="q-tag">{q.type}</span>
                    {q.qNo}. {q.text}
                  </span>
                  <span className="q-marks">{q.marks} Marks</span>
                </div>

                {/* MCQ Options */}
                {q.type === "MCQ" && q.options && (
                  <div className="options-list">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="option-item">
                        [{String.fromCharCode(65 + oIdx)}] {opt}
                      </div>
                    ))}
                  </div>
                )}

                {/* Programming starterCode template */}
                {q.starterCode && (
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 700 }}>
                      Starter Code Template:
                    </div>
                    <pre className="code-block"><code>{q.starterCode}</code></pre>
                  </div>
                )}

                {/* Math LaTeX code representation */}
                {q.latex && (
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 700 }}>
                      LaTeX Specification:
                    </div>
                    <code className="latex-code">{q.latex}</code>
                  </div>
                )}

                {/* Tab switch logic for Answer Key / marking Rubric */}
                {activeTab === "answers" && (
                  <div className="solution-box">
                    <div style={{ fontWeight: 800, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Marking Guide & Solution:
                    </div>
                    {q.solution ? (
                      <div style={{ whiteSpace: "pre-wrap" }}>
                        <strong>Solution detail:</strong>\n{q.solution}
                      </div>
                    ) : null}
                    {q.answerKey ? (
                      <div>
                        <strong>Correct Target Answer:</strong> {q.answerKey}
                      </div>
                    ) : null}
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                      Allocated Score: <strong>{q.marks} Marks</strong> based on complete code layout or derivation steps.
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Action Footer */}
      {!showFeedback && (
        <div className="action-footer">
          <button className="btn reject-btn" onClick={() => setShowFeedback(true)} disabled={approving}>
            Reject & Revise
          </button>
          <button className="btn approve-btn" onClick={handleApprove} disabled={approving}>
            {approving ? "Approving..." : "Approve & Compile Exam"}
          </button>
        </div>
      )}

      {/* Slide down feedback editor panel */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            className="feedback-panel glass-panel"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            <form onSubmit={handleRejectSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <strong style={{ fontSize: "15px", background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Submit Revision Specifications
                </strong>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Write down corrections. Targeted keywords will dynamically focus re-generation on Section A, B, or C workers.
                </p>
              </div>

              <textarea
                className="feedback-textarea"
                placeholder="Describe details (e.g. 'add a recursion coding item' or 'make mathematics Section more theoretical')..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                required
                disabled={submitting}
              />

              <div className="feedback-actions">
                <button
                  type="button"
                  className="btn feedback-cancel"
                  onClick={() => setShowFeedback(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn feedback-submit" disabled={submitting || !feedback.trim()}>
                  {submitting ? "Re-generating..." : "Submit Revision"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default CheckpointPanel;
