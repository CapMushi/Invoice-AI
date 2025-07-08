import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
  
  // Debug logging
  console.log('QuickBooks Auth Environment Variables:', {
    clientId,
    redirectUri,
    environment,
  });

  // Validate required environment variables
  if (!clientId || !redirectUri) {
    console.error('Missing required QuickBooks environment variables');
    return NextResponse.json(
      { error: 'Server configuration error - missing required credentials' },
      { status: 500 }
    );
  }

  const scope = 'com.intuit.quickbooks.accounting';
  const state = Math.random().toString(36).substring(2); // Simple random state

  const authUrl = 'https://appcenter.intuit.com/connect/oauth2';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
  });

  const fullAuthUrl = `${authUrl}?${params.toString()}`;
  console.log('Generated QuickBooks Auth URL:', fullAuthUrl);

  return NextResponse.redirect(fullAuthUrl);
} 