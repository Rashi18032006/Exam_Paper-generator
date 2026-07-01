"use client";

import React from "react";
import { motion } from "framer-motion";

interface AgentState {
  status: "waiting" | "active" | "complete";
  progress: number;
}

interface OrchestratorProps {
  agentA: AgentState;
  agentB: AgentState;
  agentC: AgentState;
  editor: AgentState;
  error: string | null;
}

export function AgentOrchestrator({ agentA, agentB, agentC, editor, error }: OrchestratorProps) {
  const getStatusLabel = (status: "waiting" | "active" | "complete") => {
    switch (status) {
      case "active":
        return "Active";
      case "complete":
        return "Complete";
      default:
        return "Waiting";
    }
  };

  const getStatusColor = (status: "waiting" | "active" | "complete") => {
    switch (status) {
      case "active":
        return "#D29922"; // Yellow
      case "complete":
        return "var(--color-approve)"; // Green
      default:
        return "var(--text-muted)"; // Gray
    }
  };

  const getCardBorder = (status: "waiting" | "active" | "complete") => {
    switch (status) {
      case "active":
        return "1px solid #D29922";
      case "complete":
        return "1px solid var(--color-approve)";
      default:
        return "1px solid var(--border-default)";
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } },
  };

  return (
    <div className="orchestrator-wrapper">
      <style jsx>{`
        .orchestrator-wrapper {
          display: flex;
          flex-direction: column;
          gap: 32px;
          width: 100%;
        }
        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border-default);
          padding-bottom: 12px;
        }
        .agents-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 768px) {
          .agents-grid {
            grid-template-columns: 1fr;
          }
        }
        .agent-card {
          background-color: var(--bg-surface);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: var(--shadow-card);
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .agent-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .agent-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .agent-icon {
          font-size: 24px;
        }
        .agent-name {
          font-weight: 600;
          font-size: 16px;
          color: var(--text-primary);
        }
        .status-dot-container {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .task-description {
          font-size: 14px;
          color: var(--text-muted);
          line-height: 1.5;
          min-height: 44px;
        }
        .progress-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .progress-bg {
          height: 6px;
          background-color: var(--bg-elevated);
          border-radius: 3px;
          overflow: hidden;
          width: 100%;
        }
        .progress-fill {
          height: 100%;
          border-radius: 3px;
        }
        .progress-label {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-muted);
          text-align: right;
        }
        .editor-row {
          width: 100%;
        }
        .editor-card {
          background-color: var(--bg-surface);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          box-shadow: var(--shadow-card);
          transition: border-color 0.3s ease;
        }
        @media (max-width: 768px) {
          .editor-card {
            flex-direction: column;
            align-items: flex-start;
          }
        }
        .error-banner {
          background-color: rgba(218, 54, 51, 0.1);
          border: 1px solid var(--color-reject);
          border-radius: var(--radius-md);
          color: var(--color-reject);
          padding: 16px;
          font-size: 14px;
          line-height: 1.5;
          text-align: center;
        }
      `}</style>

      {error && <div className="error-banner">⚠️ <strong>Generation Stopped:</strong> {error}</div>}

      <h2 className="section-title">Active AI Agents</h2>

      {/* Grid of Parallel Worker Agents */}
      <motion.div className="agents-grid" variants={containerVariants} initial="hidden" animate="show">
        {/* Agent A: Concept */}
        <motion.div
          className="agent-card"
          variants={itemVariants}
          style={{ border: getCardBorder(agentA.status) }}
        >
          <div className="agent-header">
            <div className="agent-info">
              <span className="agent-icon">🧠</span>
              <span className="agent-name">Agent A: Concept</span>
            </div>
            <div className="status-dot-container" style={{ color: getStatusColor(agentA.status) }}>
              <span className="status-dot" style={{ backgroundColor: getStatusColor(agentA.status) }} />
              {getStatusLabel(agentA.status)}
            </div>
          </div>
          <p className="task-description">
            Searches theory databases and generates multiple choice and short-answer questions.
          </p>
          <div className="progress-container">
            <div className="progress-bg">
              <motion.div
                className="progress-fill"
                style={{ backgroundColor: getStatusColor(agentA.status) }}
                animate={{ width: `${agentA.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="progress-label">{agentA.progress}%</span>
          </div>
        </motion.div>

        {/* Agent B: Programmer */}
        <motion.div
          className="agent-card"
          variants={itemVariants}
          style={{ border: getCardBorder(agentB.status) }}
        >
          <div className="agent-header">
            <div className="agent-info">
              <span className="agent-icon">💻</span>
              <span className="agent-name">Agent B: Programmer</span>
            </div>
            <div className="status-dot-container" style={{ color: getStatusColor(agentB.status) }}>
              <span className="status-dot" style={{ backgroundColor: getStatusColor(agentB.status) }} />
              {getStatusLabel(agentB.status)}
            </div>
          </div>
          <p className="task-description">
            Designs practical programming assignments, starter code, and verified solution algorithms.
          </p>
          <div className="progress-container">
            <div className="progress-bg">
              <motion.div
                className="progress-fill"
                style={{ backgroundColor: getStatusColor(agentB.status) }}
                animate={{ width: `${agentB.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="progress-label">{agentB.progress}%</span>
          </div>
        </motion.div>

        {/* Agent C: Mathematician */}
        <motion.div
          className="agent-card"
          variants={itemVariants}
          style={{ border: getCardBorder(agentC.status) }}
        >
          <div className="agent-header">
            <div className="agent-info">
              <span className="agent-icon">📐</span>
              <span className="agent-name">Agent C: Mathematician</span>
            </div>
            <div className="status-dot-container" style={{ color: getStatusColor(agentC.status) }}>
              <span className="status-dot" style={{ backgroundColor: getStatusColor(agentC.status) }} />
              {getStatusLabel(agentC.status)}
            </div>
          </div>
          <p className="task-description">
            Generates numerical calculations, math formulas, LaTeX markup, and step-by-step proofs.
          </p>
          <div className="progress-container">
            <div className="progress-bg">
              <motion.div
                className="progress-fill"
                style={{ backgroundColor: getStatusColor(agentC.status) }}
                animate={{ width: `${agentC.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="progress-label">{agentC.progress}%</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Editor Agent (Full width row below) */}
      <div className="editor-row">
        <div className="editor-card" style={{ border: getCardBorder(editor.status) }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="agent-header">
              <div className="agent-info">
                <span className="agent-icon">✍️</span>
                <span className="agent-name">Editor Agent: Compiler</span>
              </div>
              <div className="status-dot-container" style={{ color: getStatusColor(editor.status) }}>
                <span className="status-dot" style={{ backgroundColor: getStatusColor(editor.status) }} />
                {getStatusLabel(editor.status)}
              </div>
            </div>
            <p className="task-description" style={{ minHeight: "auto", margin: "8px 0 0 0" }}>
              Receives sections from all three agents, merges questions, deduplicates redundant items, checks constraints, and compiles the final draft layout.
            </p>
          </div>
          <div className="progress-container" style={{ width: "240px", flexShrink: 0 }}>
            <div className="progress-bg">
              <motion.div
                className="progress-fill"
                style={{ backgroundColor: getStatusColor(editor.status) }}
                animate={{ width: `${editor.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="progress-label">{editor.progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
