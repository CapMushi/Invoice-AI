import { NextRequest, NextResponse } from 'next/server';
import { invoiceTools } from '../../../../lib/invoiceTools';
import { generateText } from "ai";
import { openai } from '@ai-sdk/openai';
function getQuickBooksTokensFromCookies(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/quickbooks_tokens=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1] || ''));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message) {
      return NextResponse.json({ error: 'Missing user message' }, { status: 400 });
    }
    const tokens = getQuickBooksTokensFromCookies(req);
    // Call the LLM with tool orchestration
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      //model: "gpt-3.5-turbo",
      tools: invoiceTools,
      toolChoice: 'auto',
      maxSteps: 3,
      prompt: `${message}

CRITICAL RULES:
1. ALWAYS use the listInvoices tool when asked to list, show, get, or display invoices
2. NEVER generate invoice data in text format
3. NEVER provide sample or made-up invoice data
4. The listInvoices tool will return ALL invoices unless specifically filtered
5. You must use the appropriate tool even for simple requests like "show all invoices"
6. Do not apologize or explain - just call the tool

For any invoice-related request, use the appropriate tool first before providing any response.`,
      // tokens will be injected in tool execution context by the tool definitions
    });
    return NextResponse.json({ result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 