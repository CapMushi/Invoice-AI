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
    description: 'Create a new invoice immediately when customer name and amount are provided. ONLY works with existing customers - will return an error if customer is not found. ALWAYS extract and use this tool when user mentions creating an invoice with customer name and amount. Do NOT ask for additional details.',
    parameters: z.object({
      customer_name: z.string().describe('Customer name extracted from phrases like "create invoice for John" or "customer name John"'),
      amount: z.number().describe('Invoice amount extracted from phrases like "$200", "200 dollars", "amount of 200"'),
      due_date: z.string().optional().describe('Due date if mentioned (format: YYYY-MM-DD)'),
      invoice_no: z.string().optional().describe('Invoice number if mentioned'),
      customer_email: z.string().email().optional().describe('Customer email if mentioned'),
    }),
    execute: async ({ customer_name, amount, due_date, invoice_no, customer_email }) => {
      try {
        console.log(`Creating new invoice for ${customer_name} with amount $${amount}...`);
        const qbo = await getQuickBooksClient();
        
        // Find the customer by searching for existing invoices from this customer
        let customer = null;
        try {
          // Search for invoices to find customer information
          const invoices = await qbo.findInvoices({ limit: 1000 });
          if (invoices && (invoices as any).QueryResponse?.Invoice) {
            const allInvoices = (invoices as any).QueryResponse.Invoice;
            // Find an invoice from this customer (case-insensitive partial match)
            const customerInvoice = allInvoices.find((inv: any) => 
              inv.CustomerRef?.name?.toLowerCase().includes(customer_name.toLowerCase()) ||
              customer_name.toLowerCase().includes(inv.CustomerRef?.name?.toLowerCase())
            );
            
            if (customerInvoice && customerInvoice.CustomerRef) {
              customer = {
                Id: customerInvoice.CustomerRef.value,
                Name: customerInvoice.CustomerRef.name
              };
              console.log(`Found customer from existing invoices: ${customer.Name} (ID: ${customer.Id})`);
            }
          }
        } catch (error) {
          console.log(`Customer lookup through invoices failed: ${error}`);
        }
        
        // If customer not found, return an error
        if (!customer || !customer.Id) {
          throw new Error(`Customer "${customer_name}" not found. Please use an existing customer name or create the customer in QuickBooks first.`);
        }
        
        // Create invoice object
        const invoiceData = {
          CustomerRef: {
            value: customer.Id,
            name: customer.Name
          },
          ...(due_date && { DueDate: due_date }),
          ...(invoice_no && { DocNumber: invoice_no }),
          Line: [
            {
              Amount: amount,
              DetailType: "SalesItemLineDetail",
              SalesItemLineDetail: {
                ItemRef: {
                  value: "1", // Default item - you may need to adjust based on your QuickBooks setup
                  name: "Services"
                }
              }
            }
          ]
        };
        
        const newInvoice = await qbo.createInvoice(invoiceData);
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