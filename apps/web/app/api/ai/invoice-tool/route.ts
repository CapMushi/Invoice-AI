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
      prompt: message,
      // tokens will be injected in tool execution context by the tool definitions
    });
    return NextResponse.json({ result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 