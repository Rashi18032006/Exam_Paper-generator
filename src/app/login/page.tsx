"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email or password.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <style jsx>{`
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: var(--bg-primary);
          padding: 20px;
        }
        .login-card {
          width: 100%;
          max-width: 400px;
          padding: 36px;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-card);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .header-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
        }
        .logo {
          font-family: var(--font-sans);
          font-weight: 700;
          font-size: 32px;
          color: var(--accent-cyan);
          letter-spacing: -0.5px;
          text-shadow: 0 0 10px rgba(0, 217, 255, 0.2);
        }
        .logo-sub {
          color: var(--text-muted);
          font-size: 14px;
          text-align: center;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-label {
          font-size: 13px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .form-input {
          padding: 12px 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-default);
          background-color: var(--bg-elevated);
          color: var(--text-primary);
          font-size: 15px;
          font-family: var(--font-sans);
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .form-input:focus {
          border-color: var(--accent-cyan);
          box-shadow: 0 0 0 2px var(--accent-cyan-dim);
        }
        .login-btn {
          padding: 12px;
          border-radius: var(--radius-md);
          border: none;
          background-color: var(--accent-cyan);
          color: var(--bg-primary);
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: opacity 0.2s ease, transform 0.1s ease;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .login-btn:hover:not(:disabled) {
          opacity: 0.95;
        }
        .login-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error-message {
          padding: 12px;
          background-color: rgba(218, 54, 51, 0.1);
          border: 1px solid var(--color-reject);
          border-radius: var(--radius-md);
          color: var(--color-reject);
          font-size: 14px;
          text-align: center;
        }
      `}</style>
      <div className="login-card">
        <div className="header-section">
          <div className="logo">Auto-TA</div>
          <div className="logo-sub">Intelligent Agentic Exam Generator</div>
        </div>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. prof@demo.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
