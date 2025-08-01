"use client";

import { useState } from "react";

export default function CallbackTestPage() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const testCallback = async () => {
    setLoading(true);
    setResult("Testing callback route...");

    try {
      const response = await fetch(
        "/api/auth/quickbooks/callback?code=test123&realmId=456789&state=teststate",
      );
      const text = await response.text();

      setResult(
        `
Status: ${response.status} ${response.statusText}
Response: ${text}
      `.trim(),
      );
    } catch (error) {
      setResult(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const startRealOAuth = () => {
    window.location.href = "/api/auth/quickbooks/login";
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>QuickBooks Callback Test</h1>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={testCallback}
          disabled={loading}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            background: "#0070f3",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Testing..." : "Test Callback Route"}
        </button>

        <button
          onClick={startRealOAuth}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            background: "#28a745",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Start Real OAuth Flow
        </button>
      </div>

      {result && (
        <div>
          <h3>Test Result:</h3>
          <pre
            style={{
              background: "#f5f5f5",
              padding: "15px",
              border: "1px solid #ddd",
              whiteSpace: "pre-wrap",
            }}
          >
            {result}
          </pre>
        </div>
      )}

      <div style={{ marginTop: "20px" }}>
        <a href="/" style={{ color: "#0070f3" }}>
          ← Back to Home
        </a>
      </div>
    </div>
  );
}
