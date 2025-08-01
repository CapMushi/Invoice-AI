"use client";

import { useEffect, useState } from "react";

export default function DebugPage() {
  const [authStatus, setAuthStatus] = useState("checking");
  const [callbackLogs, setCallbackLogs] = useState<string[]>([]);
  const [urlParams, setUrlParams] = useState<string>("");

  useEffect(() => {
    // Check URL parameters
    const params = new URLSearchParams(window.location.search);
    setUrlParams(window.location.search);

    // Check if we have OAuth callback parameters
    if (params.has("code") && params.has("realmId")) {
      setCallbackLogs((prev) => [
        ...prev,
        "✅ OAuth callback parameters detected",
      ]);
      setCallbackLogs((prev) => [
        ...prev,
        `Code: ${params.get("code")?.substring(0, 10)}...`,
      ]);
      setCallbackLogs((prev) => [...prev, `RealmId: ${params.get("realmId")}`]);
    } else if (params.has("error")) {
      setCallbackLogs((prev) => [
        ...prev,
        `❌ OAuth error: ${params.get("error")}`,
      ]);
    } else {
      setCallbackLogs((prev) => [...prev, "ℹ️ No OAuth parameters in URL"]);
    }

    // Check authentication status
    fetch("/api/quickbooks/company-info")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setAuthStatus("not_authenticated");
          setCallbackLogs((prev) => [
            ...prev,
            `❌ Auth check failed: ${data.error}`,
          ]);
        } else {
          setAuthStatus("authenticated");
          setCallbackLogs((prev) => [...prev, "✅ Successfully authenticated"]);
        }
      })
      .catch((err) => {
        setAuthStatus("error");
        setCallbackLogs((prev) => [
          ...prev,
          `❌ Auth check error: ${err.message}`,
        ]);
      });
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>QuickBooks OAuth Debug</h1>

      <div style={{ marginBottom: "20px" }}>
        <h2>Current Status: {authStatus}</h2>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>URL Parameters:</h3>
        <pre style={{ background: "#f5f5f5", padding: "10px" }}>
          {urlParams || "No parameters"}
        </pre>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Debug Logs:</h3>
        <div style={{ background: "#f5f5f5", padding: "10px" }}>
          {callbackLogs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>

      <div>
        <h3>Actions:</h3>
        <a
          href="/api/auth/quickbooks/login"
          style={{
            background: "#0070f3",
            color: "white",
            padding: "10px 20px",
            textDecoration: "none",
            marginRight: "10px",
          }}
        >
          Start OAuth Flow
        </a>
        <a
          href="/"
          style={{
            background: "#666",
            color: "white",
            padding: "10px 20px",
            textDecoration: "none",
          }}
        >
          Back to App
        </a>
      </div>
    </div>
  );
}
