"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewExamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Wizard state: 1, 2, or 3
  const [step, setStep] = useState(1);

  // Form inputs
  const [topic, setTopic] = useState("");
  const [totalMarks, setTotalMarks] = useState(50);
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState("MEDIUM");

  // Mark distribution (defaults: 40, 35, 25)
  const [theory, setTheory] = useState(40);
  const [code, setCode] = useState(35);
  const [math, setMath] = useState(25);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const distributionSum = theory + code + math;
  const isDistributionValid = distributionSum === 100;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && topic.trim()) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDistributionValid) {
      setError("Mark distribution percentages must sum to exactly 100%.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/exam/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          topic,
          totalMarks,
          numQuestions,
          difficulty,
          distribution: {
            theory,
            code,
            math
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate exam generation.");
      }

      // Redirect to the newly created session, passing generation parameters as queries
      router.push(
        `/exam/${data.sessionId}?generate=true&topic=${encodeURIComponent(topic)}&totalMarks=${totalMarks}&numQuestions=${numQuestions}&difficulty=${difficulty}&theory=${theory}&code=${code}&math=${math}`
      );
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

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
        <div>Loading wizard...</div>
      </div>
    );
  }

  return (
    <div className="wizard-container">
      <style jsx>{`
        .wizard-container {
          min-height: 100vh;
          padding: 60px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .wizard-card {
          width: 100%;
          max-width: 540px;
          border-radius: var(--radius-lg);
          padding: 40px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-default);
          padding-bottom: 16px;
        }
        .logo-nav {
          font-size: 14px;
          color: var(--accent-cyan);
          font-weight: 700;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .logo-nav:hover {
          text-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
        }
        .steps-visual {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .step-bubble {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
          background-color: var(--bg-primary);
          border: 2px solid var(--border-default);
          color: var(--text-muted);
          transition: all 0.3s ease;
        }
        .step-bubble.active {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
          background-color: var(--accent-cyan-dim);
        }
        .step-bubble.completed {
          background-color: var(--accent-cyan);
          border-color: var(--accent-cyan);
          color: var(--bg-primary);
        }
        .step-line {
          width: 20px;
          height: 2px;
          background-color: var(--border-default);
          transition: background-color 0.3s ease;
        }
        .step-line.completed {
          background-color: var(--accent-cyan);
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .form-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          justify-content: space-between;
        }
        .form-input {
          padding: 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-default);
          background-color: rgba(0, 0, 0, 0.2);
          color: var(--text-primary);
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .form-input:focus {
          border-color: var(--accent-cyan);
          box-shadow: 0 0 0 2px var(--accent-cyan-dim);
        }
        .select-input {
          cursor: pointer;
        }
        .slider-group {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .slider-bar {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          outline: none;
          background: var(--bg-primary);
          -webkit-appearance: none;
          appearance: none;
          border: 1px solid var(--border-default);
        }
        .slider-bar::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent-cyan);
          cursor: pointer;
          border: 2px solid var(--bg-surface);
          box-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
          transition: transform 0.1s ease;
        }
        .slider-bar::-webkit-slider-thumb:hover {
          transform: scale(1.25);
        }
        .slider-value {
          font-family: var(--font-mono);
          font-size: 14px;
          width: 48px;
          text-align: right;
          color: var(--text-primary);
          font-weight: 600;
        }
        .distribution-visual {
          height: 14px;
          border-radius: 7px;
          overflow: hidden;
          background-color: rgba(0, 0, 0, 0.3);
          display: flex;
          width: 100%;
          margin: 8px 0;
          border: 1px solid var(--border-default);
        }
        .dist-segment {
          height: 100%;
          transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .legend {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-muted);
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
        }
        .legend-color {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .sum-alert {
          font-size: 13px;
          text-align: center;
          padding: 10px;
          border-radius: var(--radius-md);
          font-weight: 600;
        }
        .sum-ok {
          background-color: rgba(0, 230, 118, 0.08);
          color: var(--color-approve);
          border: 1px solid rgba(0, 230, 118, 0.15);
        }
        .sum-bad {
          background-color: rgba(255, 23, 68, 0.08);
          color: var(--color-reject);
          border: 1px solid rgba(255, 23, 68, 0.15);
        }
        .button-nav {
          display: flex;
          gap: 16px;
          margin-top: 12px;
        }
        .back-btn {
          flex: 1;
          padding: 14px;
          border-radius: var(--radius-md);
          background-color: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
        }
        .back-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
          border-color: var(--text-muted);
        }
        .next-btn {
          flex: 2;
          padding: 14px;
          border-radius: var(--radius-md);
          background: var(--gradient-primary);
          color: var(--bg-primary);
          border: none;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0 4px 15px rgba(181, 0, 255, 0.25);
        }
        .next-btn:hover:not(:disabled) {
          background: var(--gradient-hover);
          box-shadow: 0 4px 20px rgba(0, 240, 255, 0.35);
        }
        .next-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }
        .error-box {
          padding: 12px;
          background-color: rgba(255, 23, 68, 0.08);
          border: 1px solid var(--color-reject);
          border-radius: var(--radius-md);
          color: var(--color-reject);
          font-size: 14px;
          text-align: center;
          font-weight: 500;
        }
      `}</style>

      <div className="wizard-card glass-panel">
        {/* Wizard Header Progress Bubbles */}
        <div className="header-bar">
          <Link href="/dashboard" className="logo-nav">
            ← Dashboard
          </Link>
          <div className="steps-visual">
            <div className={`step-bubble ${step >= 1 ? (step > 1 ? "completed" : "active") : ""}`}>
              {step > 1 ? "✓" : "1"}
            </div>
            <div className={`step-line ${step > 1 ? "completed" : ""}`} />
            <div className={`step-bubble ${step >= 2 ? (step > 2 ? "completed" : "active") : ""}`}>
              {step > 2 ? "✓" : "2"}
            </div>
            <div className={`step-line ${step > 2 ? "completed" : ""}`} />
            <div className={`step-bubble ${step === 3 ? "active" : ""}`}>
              3
            </div>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        {/* Form Wizard Pages */}
        {step === 1 && (
          <form onSubmit={handleNext} className="form">
            <h2 className="form-title">Step 1: Topic details</h2>

            <div className="form-group">
              <label className="form-label" htmlFor="topic">Exam Topic</label>
              <input
                id="topic"
                type="text"
                className="form-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Data Structures or French Revolution"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="difficulty">Difficulty Level</label>
              <select
                id="difficulty"
                className="form-input select-input"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="EASY">Easy (Conceptual/Foundational)</option>
                <option value="MEDIUM">Medium (Intermediate/Application)</option>
                <option value="HARD">Hard (Advanced/Analytical)</option>
              </select>
            </div>

            <div className="button-nav">
              <Link href="/dashboard" className="back-btn">Cancel</Link>
              <button type="submit" className="next-btn" disabled={!topic.trim()}>
                Next: Marks & Count
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleNext} className="form">
            <h2 className="form-title">Step 2: Marks & Count</h2>

            <div className="form-group">
              <label className="form-label" htmlFor="marks">
                <span>Total Exam Marks</span>
                <span>{totalMarks} Marks</span>
              </label>
              <div className="slider-group">
                <input
                  id="marks"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  className="slider-bar"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(Number(e.target.value))}
                />
                <span className="slider-value">{totalMarks}M</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="questions">
                <span>Number of Questions</span>
                <span>{numQuestions} Items</span>
              </label>
              <div className="slider-group">
                <input
                  id="questions"
                  type="range"
                  min="5"
                  max="20"
                  step="1"
                  className="slider-bar"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                />
                <span className="slider-value">{numQuestions}Q</span>
              </div>
            </div>

            <div className="button-nav">
              <button type="button" className="back-btn" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="submit" className="next-btn">
                Next: Weights
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="form">
            <h2 className="form-title">Step 3: Weights Weighting</h2>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "-12px" }}>
              Define the percentage share of question types. The sum must equal exactly 100%.
            </p>

            {/* Stacked segment weight progress bar visual */}
            <div className="distribution-visual">
              <div className="dist-segment" style={{ width: `${theory}%`, backgroundColor: "var(--accent-cyan)" }} />
              <div className="dist-segment" style={{ width: `${code}%`, backgroundColor: "var(--color-warning)" }} />
              <div className="dist-segment" style={{ width: `${math}%`, backgroundColor: "var(--color-reject)" }} />
            </div>

            <div className="legend">
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: "var(--accent-cyan)" }} />
                <span>Theory ({theory}%)</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: "var(--color-warning)" }} />
                <span>Coding ({code}%)</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: "var(--color-reject)" }} />
                <span>Math ({math}%)</span>
              </div>
            </div>

            {/* Sliders */}
            <div className="form-group">
              <label className="form-label" htmlFor="theory-w">
                <span>Theory Share</span>
                <span>{theory}%</span>
              </label>
              <div className="slider-group">
                <input
                  id="theory-w"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  className="slider-bar"
                  value={theory}
                  onChange={(e) => setTheory(Number(e.target.value))}
                />
                <span className="slider-value">{theory}%</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="code-w">
                <span>Coding Share</span>
                <span>{code}%</span>
              </label>
              <div className="slider-group">
                <input
                  id="code-w"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  className="slider-bar"
                  value={code}
                  onChange={(e) => setCode(Number(e.target.value))}
                />
                <span className="slider-value">{code}%</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="math-w">
                <span>Math Share</span>
                <span>{math}%</span>
              </label>
              <div className="slider-group">
                <input
                  id="math-w"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  className="slider-bar"
                  value={math}
                  onChange={(e) => setMath(Number(e.target.value))}
                />
                <span className="slider-value">{math}%</span>
              </div>
            </div>

            <div className={`sum-alert ${isDistributionValid ? "sum-ok" : "sum-bad"}`}>
              {isDistributionValid
                ? `Perfect! Sharing sums to exactly 100%.`
                : `Sharing sum must equal 100%. Currently: ${distributionSum}%.`}
            </div>

            <div className="button-nav">
              <button type="button" className="back-btn" onClick={() => setStep(2)} disabled={loading}>
                Back
              </button>
              <button type="submit" className="next-btn" disabled={!isDistributionValid || loading}>
                {loading ? "Generating Exam..." : "Generate Exam Draft"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
export const dynamic = "force-dynamic";
