import { z } from 'zod';
import { tool } from 'ai';
import { cookies } from 'next/headers';

async function getQuickBooksTokens() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('quickbooks_tokens');
  if (!cookie) return null;
  try {
    return JSON.parse(cookie.value);
  } catch {
    return null;
  }
}

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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.Fault?.Error?.[0]?.Message || `QuickBooks API error: ${res.status}`);
  }
  return data;
}

export const invoiceTools = {
  getInvoice: tool({
    description: 'Get details of a specific invoice by ID',
    parameters: z.object({
      invoiceId: z.string().describe('The ID of the invoice to retrieve'),
    }),
    execute: async ({ invoiceId }) => {
      try {
        const data = await quickbooksApiRequest(`/invoice/${invoiceId}`);
        return data;
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  listInvoices: tool({
    description: 'List invoices with optional filters',
    parameters: z.object({
      start: z.number().optional().describe('Start position for pagination'),
      maxResults: z.number().optional().describe('Maximum number of invoices to return'),
      filter: z.string().optional().describe('Query filter for invoices'),
    }),
    execute: async ({ start, maxResults, filter }) => {
      try {
        let query = 'SELECT * FROM Invoice';
        if (filter) query += ` WHERE ${filter}`;
        if (maxResults) query += ` MAXRESULTS ${maxResults}`;
        if (start) query += ` STARTPOSITION ${start}`;
        const data = await quickbooksApiRequest(`/query?query=${encodeURIComponent(query)}`);
        return data;
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  createInvoice: tool({
    description: 'Create a new invoice',
    parameters: z.object({
      invoice: z.any().describe('Invoice object as per QuickBooks API'),
    }),
    execute: async ({ invoice }) => {
      try {
        const data = await quickbooksApiRequest('/invoice', 'POST', invoice);
        return data;
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  updateInvoice: tool({
    description: 'Update an existing invoice',
    parameters: z.object({
      invoice: z.any().describe('Invoice object with updated fields'),
    }),
    execute: async ({ invoice }) => {
      try {
        const data = await quickbooksApiRequest('/invoice', 'POST', invoice);
        return data;
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  deleteInvoice: tool({
    description: 'Delete an invoice by ID',
    parameters: z.object({
      invoiceId: z.string().describe('The ID of the invoice to delete'),
    }),
    execute: async ({ invoiceId }) => {
      try {
        // First, get the invoice to get its current state and sync token
        const getResponse = await quickbooksApiRequest(`/invoice/${invoiceId}`);
        
        const invoice = getResponse.QueryResponse?.Invoice?.[0];
        if (!invoice) {
          throw new Error(`Invoice with ID ${invoiceId} not found`);
        }
        
        // QuickBooks requires the sync token for delete operations
        const deletePayload = {
          Id: invoiceId,
          SyncToken: invoice.SyncToken
        };
        
        // QuickBooks "deletes" by setting status to Deleted via POST with operation=delete
        const data = await quickbooksApiRequest(`/invoice?operation=delete`, 'POST', deletePayload);
        
        return data;
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  emailInvoicePdf: tool({
    description: 'Email an invoice PDF to a recipient',
    parameters: z.object({
      invoiceId: z.string().describe('The ID of the invoice to email'),
      email: z.string().email().describe('Recipient email address'),
    }),
    execute: async ({ invoiceId, email }) => {
      try {
        // QuickBooks Online API send endpoint: POST /invoice/{id}/send?sendTo={email}
        // The email address is sent as a query parameter, not in the request body
        const data = await quickbooksApiRequest(`/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(email)}`, 'POST');
        
        return data;
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),
}; 