"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    } else if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  return (
    <div className="redirect-container">
      <style jsx>{`
        .redirect-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: var(--bg-primary);
          color: var(--text-muted);
          font-family: var(--font-sans);
          font-size: 14px;
        }
      `}</style>
      <div>Redirecting to dashboard...</div>
    </div>
  );
}
