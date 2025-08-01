"use client";

import { useEffect, useState } from "react";

export default function TestCallbackPage() {
  const [result, setResult] = useState<string>("Testing...");

  useEffect(() => {
    // Test the callback URL with dummy parameters
    fetch("/api/auth/quickbooks/callback?code=test123&realmId=456&state=dummy")
      .then((response) => {
        setResult(`Status: ${response.status} ${response.statusText}`);
        return response.text();
      })
      .then((text) => {
        setResult((prev) => prev + "\n\nResponse: " + text);
      })
      .catch((error) => {
        setResult("Error: " + error.message);
      });
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>Callback Route Test</h1>
      <pre>{result}</pre>
      <div style={{ marginTop: "20px" }}>
        <a href="/">Back to Home</a>
      </div>
    </div>
  );
}
