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
    
    // Check if the message is about invoices
    const messageLower = message.toLowerCase();
    const invoiceKeywords = ['invoice', 'invoices', 'show', 'list', 'get', 'fetch', 'display', 'find', 'search', 'unpaid', 'paid', 'outstanding', 'due', 'overdue'];
    const isInvoiceRelated = invoiceKeywords.some(keyword => messageLower.includes(keyword));
    
    // Check if it's a general conversation
    const generalKeywords = ['hi', 'hello', 'hey', 'how are you', 'good morning', 'good afternoon', 'good evening', 'thanks', 'thank you', 'what can you do', 'help', 'capabilities'];
    const isGeneralConversation = generalKeywords.some(keyword => messageLower.includes(keyword)) && !isInvoiceRelated;
    
    // console.log('🔍 API Route - Message:', message);
    // console.log('🔍 API Route - Is invoice related:', isInvoiceRelated);
    // console.log('🔍 API Route - Is general conversation:', isGeneralConversation);
    // console.log('🔍 API Route - Tool choice:', isGeneralConversation ? 'none' : (isInvoiceRelated ? 'required' : 'auto'));
    // console.log('🔍 API Route - Available tools:', Object.keys(invoiceTools));
    
    // Call the LLM with tool orchestration
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      //model: "gpt-3.5-turbo",
      tools: invoiceTools,
      toolChoice: isGeneralConversation ? 'none' : (isInvoiceRelated ? 'required' : 'auto'), // No tools for general conversation, required for invoice queries
      maxSteps: 5,
      prompt: `${message}

${isGeneralConversation ? `
GENERAL CONVERSATION:
Respond naturally to greetings like "hi", "hello", "how are you", etc.
For general questions or conversation, provide helpful and friendly responses.
Always be welcoming and professional in your tone.
If users ask about your capabilities, mention that you can help with invoice management, creation, updates, deletion, listing, and emailing.
DO NOT call any tools for general conversation.
` : `
INVOICE MANAGEMENT INSTRUCTIONS:

1. For ANY request about invoices (show, list, get, display, fetch invoices), you MUST call the listInvoices tool first
2. You are FORBIDDEN from generating any invoice data in text format
3. You MUST NOT provide sample, fake, or made-up invoice data
4. You MUST call the appropriate tool even for simple requests like "show all invoices"
5. NEVER respond with text about invoices without first calling a tool
6. If asked about invoices, your first action must be to call listInvoices or getInvoice

${isInvoiceRelated ? 'The user is asking about invoices, so you MUST call the listInvoices tool now.' : ''}
`}`,
      // tokens will be injected in tool execution context by the tool definitions
    });
    
    // Debug logging for API route
    // console.log('🔍 API Route - Generate Text Result:', result);
    // console.log('🔍 API Route - Tool Calls:', result.toolCalls);
    // console.log('🔍 API Route - Tool Results:', result.toolResults);
    
    return NextResponse.json({ result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 