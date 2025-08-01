import { NextRequest, NextResponse } from "next/server";

console.log("🚀 QuickBooks Callback Route LOADED at", new Date().toISOString());

export async function GET(req: NextRequest) {
  console.log("🔍 QuickBooks Callback: Request received");
  console.log("🔍 QuickBooks Callback: Full URL:", req.url);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  console.log("🔍 QuickBooks Callback: URL params:", {
    code: code ? "present" : "missing",
    realmId: realmId ? realmId : "missing",
    state: state ? "present" : "missing",
    error: error || "none",
  });

  if (error) {
    console.error("❌ QuickBooks Callback: OAuth error:", error);
    return NextResponse.json(
      { error: `OAuth error: ${error}` },
      { status: 400 },
    );
  }

  if (!code) {
    console.error("❌ QuickBooks Callback: Missing authorization code");
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  if (!realmId) {
    console.error("❌ QuickBooks Callback: Missing realmId");
    return NextResponse.json({ error: "Missing realmId" }, { status: 400 });
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Server configuration error - missing required credentials" },
      { status: 500 },
    );
  }

  const tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  console.log("🔍 QuickBooks Callback: Exchanging code for tokens...");

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const tokenData = await tokenRes.json();

  console.log(
    "🔍 QuickBooks Callback: Token response status:",
    tokenRes.status,
  );
  console.log("🔍 QuickBooks Callback: Token data received:", {
    access_token: tokenData.access_token ? "present" : "missing",
    refresh_token: tokenData.refresh_token ? "present" : "missing",
    expires_in: tokenData.expires_in,
    token_type: tokenData.token_type,
  });

  if (!tokenRes.ok) {
    console.error("❌ QuickBooks Callback: Token exchange failed:", tokenData);
    return NextResponse.json({ error: tokenData }, { status: tokenRes.status });
  }

  // Add realmId to token data before storing
  const tokenDataWithRealmId = {
    ...tokenData,
    realmId: realmId,
  };

  console.log(
    "🔍 QuickBooks Callback: Storing tokens and redirecting to home...",
  );
  console.log("🔍 QuickBooks Callback: Token data to store:", {
    access_token: tokenDataWithRealmId.access_token ? "present" : "missing",
    refresh_token: tokenDataWithRealmId.refresh_token ? "present" : "missing",
    realmId: tokenDataWithRealmId.realmId,
  });

  // Store tokens both in cookie and localStorage for iframe compatibility
  const baseUrl = new URL(req.url).origin;

  // Create an HTML response that stores tokens in localStorage and redirects
  const tokensScript = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Success</title>
    </head>
    <body>
      <script>
        try {
          localStorage.setItem('quickbooks_tokens', '${JSON.stringify(tokenDataWithRealmId).replace(/'/g, "\\'")}');
          console.log('✅ Tokens stored in localStorage');
          window.location.href = '/?auth=success&realmId=${realmId}';
        } catch (e) {
          console.error('❌ Failed to store tokens:', e);
          window.location.href = '/?auth=error';
        }
      </script>
      <p>Redirecting...</p>
    </body>
    </html>
  `;

  console.log(
    "✅ QuickBooks Callback: Tokens stored, redirecting to home page",
  );

  const response = new Response(tokensScript, {
    headers: { "Content-Type": "text/html" },
  });

  // Also set the cookie as backup
  response.headers.set(
    "Set-Cookie",
    `quickbooks_tokens=${JSON.stringify(tokenDataWithRealmId)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`,
  );

  return response;
}
