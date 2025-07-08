import { z } from 'zod';
import { tool } from 'ai';
import { getQuickBooksClient, handleSDKError } from './quickbooksClient';

export const invoiceTools = {
  getInvoice: tool({
    description: 'Get details of a specific invoice by ID',
    parameters: z.object({
      invoiceId: z.string().describe('The ID of the invoice to retrieve'),
    }),
    execute: async ({ invoiceId }) => {
      try {
        console.log(`Retrieving invoice ${invoiceId} using SDK...`);
        const qbo = await getQuickBooksClient();
        
        const invoice = await qbo.getInvoice(invoiceId);
        console.log(`Successfully retrieved invoice ${invoiceId}`);
        
        return invoice;
      } catch (error: any) {
        console.error(`Failed to retrieve invoice ${invoiceId}:`, error);
        return handleSDKError(error);
      }
    },
  }),

  listInvoices: tool({
    description: 'List ALL invoices with optional filters. Always returns ALL invoices unless specifically limited. Use "unpaid" to filter unpaid invoices, "paid" for paid invoices, or specify a customer name. Do not limit results unless explicitly requested.',
    parameters: z.object({
      start: z.number().optional().describe('Start position for pagination'),
      maxResults: z.number().optional().describe('Maximum number of invoices to return - leave empty to get ALL invoices'),
      filter: z.string().optional().describe('Filter type: "unpaid", "paid", or customer name'),
    }),
    execute: async ({ start, maxResults, filter }) => {
      try {
        console.log('Listing invoices using SDK with filters:', { start, maxResults, filter });
        const qbo = await getQuickBooksClient();
        
        // Build criteria object for SDK
        const criteria: any = {};
        
        // For now, let's fetch all invoices and filter client-side to avoid QB API issues
        let clientSideFilter = null;
        if (filter) {
          const filterLower = filter.toLowerCase();
          if (filterLower.includes('unpaid') || filterLower.includes('open') || filterLower.includes('outstanding')) {
            clientSideFilter = 'unpaid';
          } else if (filterLower.includes('paid') || filterLower.includes('closed')) {
            clientSideFilter = 'paid';
          } else if (filterLower.includes('overdue')) {
            clientSideFilter = 'overdue';
          } else {
            clientSideFilter = filter; // customer name or other
          }
        }
        
        if (maxResults) {
          criteria.limit = maxResults;
        } else {
          // Set a very high limit to ensure we get ALL invoices when no limit is specified
          criteria.limit = 1000;
        }
        
        if (start) {
          criteria.offset = start;
        }
        
        const invoices = await qbo.findInvoices(criteria);
        const initialCount = (invoices as any)?.QueryResponse?.Invoice?.length || 0;
        console.log(`Successfully retrieved ${initialCount} invoices from QuickBooks`);
        
        // Apply client-side filtering if needed
        if (clientSideFilter && invoices && (invoices as any).QueryResponse?.Invoice) {
          const allInvoices = (invoices as any).QueryResponse.Invoice;
          let filteredInvoices = allInvoices;
          
          if (clientSideFilter === 'unpaid') {
            filteredInvoices = allInvoices.filter((inv: any) => 
              inv.Balance && parseFloat(inv.Balance) > 0
            );
          } else if (clientSideFilter === 'paid') {
            filteredInvoices = allInvoices.filter((inv: any) => 
              !inv.Balance || parseFloat(inv.Balance) === 0
            );
          } else if (clientSideFilter === 'overdue') {
            const today = new Date();
            filteredInvoices = allInvoices.filter((inv: any) => {
              if (!inv.DueDate || !inv.Balance) return false;
              const dueDate = new Date(inv.DueDate);
              return dueDate < today && parseFloat(inv.Balance) > 0;
            });
          } else {
            // Filter by customer name
            filteredInvoices = allInvoices.filter((inv: any) => 
              inv.CustomerRef?.name?.toLowerCase().includes(clientSideFilter.toLowerCase())
            );
          }
          
          console.log(`Filtered to ${filteredInvoices.length} invoices based on filter: ${clientSideFilter}`);
          
          return {
            QueryResponse: {
              Invoice: filteredInvoices
            }
          };
        }
        
        return invoices;
      } catch (error: any) {
        console.error('Failed to list invoices:', error);
        return handleSDKError(error);
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
        console.log('Creating new invoice using SDK...');
        const qbo = await getQuickBooksClient();
        
        const newInvoice = await qbo.createInvoice(invoice);
        console.log(`Successfully created invoice with ID: ${(newInvoice as any)?.Id}`);
        
        return newInvoice;
      } catch (error: any) {
        console.error('Failed to create invoice:', error);
        return handleSDKError(error);
      }
    },
  }),

  updateInvoice: tool({
    description: 'Update an existing invoice',
    parameters: z.object({
      invoice: z.any().describe('Invoice object with updated fields including Id and SyncToken'),
    }),
    execute: async ({ invoice }) => {
      try {
        console.log(`Updating invoice ${(invoice as any).Id} using SDK...`);
        const qbo = await getQuickBooksClient();
        
        // For voiding: include void: true in the invoice object
        const updatedInvoice = await qbo.updateInvoice(invoice);
        console.log(`Successfully updated invoice ${(invoice as any).Id}`);
        
        return updatedInvoice;
      } catch (error: any) {
        console.error(`Failed to update invoice ${(invoice as any)?.Id}:`, error);
        return handleSDKError(error);
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
        console.log(`Deleting invoice ${invoiceId} using SDK...`);
        const qbo = await getQuickBooksClient();
        
        // SDK handles the get-and-delete process automatically
        const deletedInvoice = await qbo.deleteInvoice(invoiceId);
        console.log(`Successfully deleted invoice ${invoiceId}`);
        
        return deletedInvoice;
      } catch (error: any) {
        console.error(`Failed to delete invoice ${invoiceId}:`, error);
        return handleSDKError(error);
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
        console.log(`Emailing invoice ${invoiceId} PDF to ${email} using SDK...`);
        const qbo = await getQuickBooksClient();
        
        // First verify the invoice exists
        console.log(`Verifying invoice ${invoiceId} exists...`);
        const invoice = await qbo.getInvoice(invoiceId);
        
        if (!invoice) {
          throw new Error(`Invoice with ID ${invoiceId} not found`);
        }
        
        console.log(`Invoice found: ${(invoice as any).DocNumber}, Customer: ${(invoice as any).CustomerRef?.name}`);
        
        // Send the invoice PDF using SDK
        const result = await qbo.sendInvoicePdf(invoiceId, email);
        console.log(`Successfully sent invoice ${invoiceId} PDF to ${email}`);
        
        return result;
      } catch (error: any) {
        console.error(`Failed to email invoice ${invoiceId} PDF to ${email}:`, error);
        return handleSDKError(error);
      }
    },
  }),
}; 