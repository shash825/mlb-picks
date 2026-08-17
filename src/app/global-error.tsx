"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#0a0c10",
          color: "#e7eaf0",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          minHeight: "100vh",
        }}
      >
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "80px 20px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>
            The page hit an unexpected error. Reloading usually clears it. No
            picks were generated, so nothing was charged.
          </p>
          {error.digest ? (
            <p style={{ color: "#475569", fontSize: 12, marginTop: 12 }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#0ea5e9",
              color: "#0a0c10",
              border: 0,
              borderRadius: 8,
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
