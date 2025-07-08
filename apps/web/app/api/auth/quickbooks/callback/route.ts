import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const realmId = url.searchParams.get('realmId');

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  if (!realmId) {
    return NextResponse.json({ error: 'Missing realmId' }, { status: 400 });
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Server configuration error - missing required credentials' },
      { status: 500 }
    );
  }

  const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body,
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json({ error: tokenData }, { status: tokenRes.status });
  }

  // Add realmId to token data before storing
  const tokenDataWithRealmId = {
    ...tokenData,
    realmId: realmId
  };

  // Store tokens in a secure, HTTP-only cookie and redirect to main app
  const baseUrl = new URL(req.url).origin;
  const response = NextResponse.redirect(`${baseUrl}/`);
  response.cookies.set('quickbooks_tokens', JSON.stringify(tokenDataWithRealmId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
  return response;
} 