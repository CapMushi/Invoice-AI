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
    const invoiceKeywords = ['invoice', 'invoices', 'show', 'list', 'get', 'fetch', 'display', 'find', 'search', 'unpaid', 'paid', 'outstanding', 'due', 'overdue', 'create', 'update', 'delete', 'email', 'send'];
    const isInvoiceRelated = invoiceKeywords.some(keyword => messageLower.includes(keyword));
    
    // Check if it's a general conversation
    const generalKeywords = ['hi', 'hello', 'hey', 'how are you', 'good morning', 'good afternoon', 'good evening', 'thanks', 'thank you', 'what can you do', 'help', 'capabilities'];
    const isGeneralConversation = generalKeywords.some(keyword => messageLower.includes(keyword)) && !isInvoiceRelated;
    
    // Debug logging
    console.log('🔍 AI Route Debug:', {
      message: message,
      messageLower: messageLower,
      isInvoiceRelated: isInvoiceRelated,
      isGeneralConversation: isGeneralConversation,
      matchedKeywords: invoiceKeywords.filter(k => messageLower.includes(k))
    });
    
    // Detect multi-step operations
    const isMultiStep = messageLower.includes('and') || 
                       messageLower.includes('then') || 
                       messageLower.includes('after') ||
                       (messageLower.includes('create') && messageLower.includes('email')) ||
                       (messageLower.includes('update') && (messageLower.includes('send') || messageLower.includes('email'))) ||
                       (messageLower.includes('find') && messageLower.includes('update')) ||
                       (messageLower.includes('get') && (messageLower.includes('update') || messageLower.includes('delete')));
    
    // Track workflow steps for multi-step operations
    const workflowSteps: string[] = [];
    
    // Call the LLM with tool orchestration
    const toolChoice = isGeneralConversation ? 'none' : (isInvoiceRelated ? 'required' : 'auto');
    console.log('🔍 AI Route Tool Choice:', toolChoice);
    
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      tools: invoiceTools,
      toolChoice: toolChoice,
      maxSteps: isMultiStep ? 5 : 1, // Only allow multiple steps for multi-step operations
      prompt: isGeneralConversation ? 
        `${message}

You are a helpful assistant for invoice management. Respond naturally to greetings and general questions. If users ask about your capabilities, mention that you can help with invoice management, creation, updates, deletion, listing, and emailing. DO NOT call any tools for general conversation.` :
        `User request: ${message}

ANALYZE THE REQUEST AND CALL THE CORRECT TOOL:

**LIST/SHOW INVOICES** - Use listInvoices tool:
- "show invoices", "list invoices", "get invoices", "display invoices", "show all invoices", "list all invoices"
- "show unpaid invoices", "list unpaid invoices" → use filter: "unpaid"
- "show paid invoices", "list paid invoices" → use filter: "paid"
- "show invoices for [customer]" → use filter: "[customer name]"
- DO NOT use start or maxResults parameters - leave them empty to get ALL invoices

**GET SPECIFIC INVOICE** - Use getInvoice tool:
- "show invoice [ID]", "get invoice [ID]", "display invoice [ID]", "find invoice [ID]"
- Extract the ID from the request - REMOVE any "#" characters (e.g., "#1055" becomes "1055")
- Common formats: "invoice #123", "invoice#123", "invoice 123", "#123" → all become "123"

**CREATE INVOICE** - Use createInvoice tool:
- "create invoice", "make invoice", "add invoice", "new invoice"
- Extract: customer_name, amount, due_date (optional), invoice_no (optional)

**UPDATE INVOICE** - Use updateInvoice tool:
- "update invoice [ID]", "change invoice [ID]", "modify invoice [ID]"
- Extract: invoiceId (remove "#" if present), amount, customer_name, due_date, description, status, paid, balance

**DELETE INVOICE** - Use deleteInvoice tool:
- "delete invoice [ID]", "remove invoice [ID]", "cancel invoice [ID]"
- Extract: invoiceId (remove "#" if present)

**EMAIL INVOICE** - Use emailInvoicePdf tool:
- "email invoice [ID]", "send invoice [ID]", "mail invoice [ID]"
- Extract: invoiceId (remove "#" if present), email

IMPORTANT: Call the tool ONLY ONCE. Do not make multiple calls or use pagination.`,
      onStepFinish: ({ text, toolCalls, toolResults }) => {
        // Track each step for multi-step workflows
        if (toolCalls && toolCalls.length > 0) {
          toolCalls.forEach((call, index) => {
            const toolResult = toolResults?.[index];
            const stepDescription = `Step ${workflowSteps.length + 1}: ${call.toolName}`;
            const hasError = toolResult?.result && typeof toolResult.result === 'object' && 'error' in toolResult.result;
            const stepStatus = hasError ? 'Failed' : 'Completed';
            workflowSteps.push(`${stepDescription} - ${stepStatus}`);
            
            // Add detailed logging for debugging
            console.log(`🔍 AI Route - Tool Called: ${call.toolName}`);
            console.log(`🔍 AI Route - Tool Args:`, call.args);
            console.log(`🔍 AI Route - Tool Result:`, toolResult?.result);
            console.log(`🔍 AI Route - Tool Status:`, stepStatus);
          });
        }
      }
    });
    
    // Enhanced result processing for multi-step workflows
    const enhancedResult = {
      ...result,
      workflowSteps: workflowSteps,
      isMultiStep: isMultiStep,
      totalSteps: result.toolCalls?.length || 0,
      completedSteps: workflowSteps.filter(step => step.includes('Completed')).length,
      failedSteps: workflowSteps.filter(step => step.includes('Failed')).length
    };
    
    return NextResponse.json({ result: enhancedResult });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 