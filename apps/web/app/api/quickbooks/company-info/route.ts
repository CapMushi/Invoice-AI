import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksTokens } from '../../../../lib/quickbooksTokens';

async function quickbooksApiRequest(path: string, method = 'GET', body?: any) {
  const tokens = await getQuickBooksTokens();
  if (!tokens || !tokens.access_token || !tokens.realmId) {
    throw new Error('QuickBooks not authenticated');
  }
  const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
  const baseUrl = `https://${environment === 'sandbox' ? 'sandbox-' : ''}quickbooks.api.intuit.com/v3/company/${tokens.realmId}`;
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`QuickBooks API error: ${res.status}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  try {
    const tokens = await getQuickBooksTokens();
    const data = await quickbooksApiRequest('/companyinfo/' + tokens.realmId);
    return NextResponse.json({ companyInfo: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
} 