import { z } from 'zod';
import { tool } from 'ai';
import { getQuickBooksClient, handleSDKError } from './quickbooksClient';

export const invoiceTools = {
  getInvoice: tool({
    description: 'Get details of a specific invoice by ID or Number. Use when user requests to view, show, display, or get a specific invoice with an ID number or document number.',
    parameters: z.object({
      invoiceId: z.string().describe('The ID or Number of the invoice to retrieve'),
    }),
    execute: async ({ invoiceId }) => {
      try {
        console.log(`🔍 getInvoice: Retrieving invoice ${invoiceId} using SDK...`);
        const qbo = await getQuickBooksClient();
        
        let invoice = null;
        
        // First, try to get invoice by direct ID
        try {
          console.log(`🔍 getInvoice: Trying direct ID lookup for ${invoiceId}...`);
          invoice = await qbo.getInvoice(invoiceId);
          console.log(`🔍 getInvoice: Direct ID lookup result:`, invoice);
          
          // Verify the returned invoice has the exact ID we requested
          if (invoice && (invoice as any)?.Id) {
            const returnedId = (invoice as any).Id;
            if (returnedId === invoiceId || returnedId.toString() === invoiceId) {
              console.log(`✅ getInvoice: Found invoice by direct ID lookup`);
            } else {
              // ID mismatch, this isn't the right invoice
              invoice = null;
            }
          } else {
            invoice = null;
          }
        } catch (directError: any) {
          console.log(`🔍 getInvoice: Direct ID lookup failed, will try DocNumber search:`, directError.message);
          invoice = null;
        }
        
        // If direct ID lookup failed, search by DocNumber
        if (!invoice) {
          console.log(`🔍 getInvoice: Searching by DocNumber for ${invoiceId}...`);
          try {
            const invoices = await qbo.findInvoices({ limit: 1000 });
            console.log(`🔍 getInvoice: Search response:`, invoices);
            
            if (invoices && (invoices as any).QueryResponse?.Invoice) {
              const allInvoices = (invoices as any).QueryResponse.Invoice;
              console.log(`🔍 getInvoice: Searching through ${allInvoices.length} invoices for DocNumber ${invoiceId}...`);
              
              // Find invoice by DocNumber
              const foundInvoice = allInvoices.find((inv: any) => {
                const docNumber = inv.DocNumber;
                console.log(`🔍 getInvoice: Checking invoice ID ${inv.Id}, DocNumber: ${docNumber}`);
                return docNumber === invoiceId || docNumber?.toString() === invoiceId;
              });
              
              if (foundInvoice) {
                console.log(`✅ getInvoice: Found invoice by DocNumber search - ID: ${foundInvoice.Id}, DocNumber: ${foundInvoice.DocNumber}`);
                invoice = foundInvoice;
              }
            }
          } catch (searchError) {
            console.error(`❌ getInvoice: DocNumber search failed:`, searchError);
          }
        }
        
        // Final check - do we have an invoice?
        if (!invoice || !(invoice as any)?.Id) {
          console.log(`❌ getInvoice: Invoice with ID/Number ${invoiceId} does not exist (no invoice found)`);
          throw new Error(`Invoice with ID/Number ${invoiceId} does not exist`);
        }
        
        console.log(`✅ getInvoice: Successfully retrieved invoice ${invoiceId}`);
        
        // Generate natural language summary for the invoice
        const generateInvoiceSummary = (invoice: any) => {
          const customer = invoice.CustomerRef?.name || 'Unknown Customer';
          const amount = parseFloat(invoice.TotalAmt) || 0;
          const balance = parseFloat(invoice.Balance) || 0;
          const date = invoice.TxnDate ? new Date(invoice.TxnDate).toLocaleDateString() : 'No date';
          const dueDate = invoice.DueDate ? new Date(invoice.DueDate).toLocaleDateString() : 'No due date';
          const status = balance > 0 ? 'Unpaid' : 'Paid';
          const docNumber = invoice.DocNumber || invoice.Id;
          
          let summary = `**Invoice #${docNumber}**\n\n`;
          summary += `**Customer:** ${customer}\n`;
          summary += `**Amount:** $${amount.toFixed(2)}\n`;
          summary += `**Balance:** $${balance.toFixed(2)}\n`;
          summary += `**Status:** ${status}\n`;
          summary += `**Date:** ${date}\n`;
          summary += `**Due Date:** ${dueDate}\n\n`;
          
          // Add line items if available
          if (invoice.Line && invoice.Line.length > 0) {
            summary += `**Line Items:**\n`;
            invoice.Line.forEach((line: any, index: number) => {
              const description = line.Description || 'No description';
              const lineAmount = parseFloat(line.Amount) || 0;
              summary += `${index + 1}. ${description} - $${lineAmount.toFixed(2)}\n`;
            });
          }
          
          return summary;
        };
        
        const naturalLanguageSummary = generateInvoiceSummary(invoice);
        console.log(`🔍 getInvoice: Generated summary:`, naturalLanguageSummary);
        
        // Return both the structured data and natural language summary
        const result = {
          ...invoice,
          summary: naturalLanguageSummary
        };
        console.log(`🔍 getInvoice: Final result structure:`, Object.keys(result));
        return result;
      } catch (error: any) {
        console.error(`❌ getInvoice: Failed to retrieve invoice ${invoiceId}:`, error);
        return handleSDKError(error);
      }
    },
  }),

  listInvoices: tool({
    description: 'List multiple invoices with optional filtering. Use when user requests to show, list, get, or display multiple invoices (not a specific invoice ID). Can filter by paid/unpaid status or customer name.',
    parameters: z.object({
      filter: z.string().optional().describe('Filter type: "unpaid", "paid", or customer name'),
    }),
    execute: async ({ filter }) => {
      try {
        console.log('🔍 listInvoices: TOOL CALLED with params:', { filter });
        
        // Add detailed debugging
        console.log('🔍 listInvoices: Starting QuickBooks client connection...');
        const qbo = await getQuickBooksClient();
        console.log('🔍 listInvoices: QuickBooks client connected successfully');
        
        // Build criteria object for SDK - always get ALL invoices
        const criteria: any = {
          limit: 1000  // Set high limit to get all invoices
        };
        
        // For now, let's fetch all invoices and filter client-side to avoid QB API issues
        let clientSideFilter = null;
        let filterDescription = 'invoices'; // Changed from 'all invoices' to 'invoices' for better grammar
        
        if (filter) {
          const filterLower = filter.toLowerCase();
          console.log('🔍 listInvoices: Processing filter:', filterLower);
          if (filterLower.includes('unpaid') || filterLower.includes('open') || filterLower.includes('outstanding')) {
            clientSideFilter = 'unpaid';
            filterDescription = 'unpaid invoices';
          } else if (filterLower.includes('paid') || filterLower.includes('closed')) {
            clientSideFilter = 'paid';
            filterDescription = 'paid invoices';
          } else if (filterLower.includes('overdue')) {
            clientSideFilter = 'overdue';
            filterDescription = 'overdue invoices';
          } else {
            clientSideFilter = filter; // customer name or other
            filterDescription = `invoices for "${filter}"`;
          }
        }
        
        console.log('🔍 listInvoices: Criteria for QuickBooks API:', criteria);
        console.log('🔍 listInvoices: Making API call to QuickBooks...');
        
        const invoices = await qbo.findInvoices(criteria);
        
        console.log('🔍 listInvoices: Raw response from QuickBooks:', invoices);
        console.log('🔍 listInvoices: Response type:', typeof invoices);
        console.log('🔍 listInvoices: Response keys:', invoices ? Object.keys(invoices) : 'null');
        
        if (invoices && (invoices as any).QueryResponse) {
          console.log('🔍 listInvoices: QueryResponse keys:', Object.keys((invoices as any).QueryResponse));
          console.log('🔍 listInvoices: QueryResponse.Invoice type:', typeof (invoices as any).QueryResponse.Invoice);
          console.log('🔍 listInvoices: QueryResponse.Invoice length:', (invoices as any).QueryResponse.Invoice?.length);
        }
        
        const initialCount = (invoices as any)?.QueryResponse?.Invoice?.length || 0;
        console.log(`🔍 listInvoices: Successfully retrieved ${initialCount} invoices from QuickBooks`);
        
        // Apply client-side filtering if needed
        let filteredInvoices = [];
        if (invoices && (invoices as any).QueryResponse?.Invoice) {
          const allInvoices = (invoices as any).QueryResponse.Invoice;
          console.log(`🔍 listInvoices: Processing ${allInvoices.length} invoices for filtering`);
          filteredInvoices = allInvoices;
          
          if (clientSideFilter) {
            console.log(`🔍 listInvoices: Applying client-side filter: ${clientSideFilter}`);
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
          }
          
          console.log(`🔍 listInvoices: Filtered to ${filteredInvoices.length} invoices based on filter: ${clientSideFilter}`);
        } else {
          console.log('🔍 listInvoices: No invoices found in response or invalid response structure');
        }
        
        // Generate natural language summary
        const generateSummary = (invoices: any[], filterDesc: string) => {
          if (invoices.length === 0) {
            return `No ${filterDesc} found.`;
          }
          
          const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.TotalAmt) || 0), 0);
          const totalBalance = invoices.reduce((sum, inv) => sum + (parseFloat(inv.Balance) || 0), 0);
          
          let summary = `Found ${invoices.length} ${filterDesc}`;
          
          if (invoices.length <= 10) {
            summary += ':\n\n';
            
            invoices.forEach((inv, index) => {
              const customer = inv.CustomerRef?.name || 'Unknown Customer';
              const amount = parseFloat(inv.TotalAmt) || 0;
              const balance = parseFloat(inv.Balance) || 0;
              const date = inv.TxnDate ? new Date(inv.TxnDate).toLocaleDateString() : 'No date';
              const dueDate = inv.DueDate ? new Date(inv.DueDate).toLocaleDateString() : 'No due date';
              const status = balance > 0 ? 'Unpaid' : 'Paid';
              
              summary += `${index + 1}. **Invoice #${inv.DocNumber || inv.Id}** - ${customer}\n`;
              summary += `   Amount: $${amount.toFixed(2)} | Balance: $${balance.toFixed(2)} | Status: ${status}\n`;
              summary += `   Date: ${date} | Due: ${dueDate}\n\n`;
            });
          } else {
            summary += `.\n\n`;
            summary += `**Summary:**\n`;
            summary += `- Total Amount: $${totalAmount.toFixed(2)}\n`;
            summary += `- Total Outstanding Balance: $${totalBalance.toFixed(2)}\n`;
            summary += `- Paid Invoices: ${invoices.filter(inv => !inv.Balance || parseFloat(inv.Balance) === 0).length}\n`;
            summary += `- Unpaid Invoices: ${invoices.filter(inv => inv.Balance && parseFloat(inv.Balance) > 0).length}\n\n`;
            
            if (invoices.length > 10) {
              summary += `Showing first 10 invoices in the cards panel. Use more specific filters to narrow down results.\n\n`;
              
              invoices.slice(0, 10).forEach((inv, index) => {
                const customer = inv.CustomerRef?.name || 'Unknown Customer';
                const amount = parseFloat(inv.TotalAmt) || 0;
                const balance = parseFloat(inv.Balance) || 0;
                const status = balance > 0 ? 'Unpaid' : 'Paid';
                
                summary += `${index + 1}. **Invoice #${inv.DocNumber || inv.Id}** - ${customer} - $${amount.toFixed(2)} (${status})\n`;
              });
            }
          }
          
          return summary;
        };
        
        const naturalLanguageSummary = generateSummary(filteredInvoices, filterDescription);
        console.log(`🔍 listInvoices: Generated summary:`, naturalLanguageSummary);
        
        // Return both the structured data and natural language summary
        const result = {
          QueryResponse: {
            Invoice: filteredInvoices
          },
          summary: naturalLanguageSummary,
          count: filteredInvoices.length,
          filterApplied: filterDescription
        };
        console.log(`🔍 listInvoices: Final result structure:`, {
          invoiceCount: result.QueryResponse.Invoice.length,
          summary: result.summary.substring(0, 100) + '...',
          count: result.count,
          filterApplied: result.filterApplied
        });
        return result;
      } catch (error: any) {
        console.error('❌ listInvoices: Failed to list invoices:', error);
        return handleSDKError(error);
      }
    },
  }),

  createInvoice: tool({
    description: 'Create a new invoice. Use ONLY when user explicitly requests to create, make, add, or insert a new invoice with customer name and amount. Requires existing customer.',
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
    description: 'Update an existing invoice by ID or Number. Use ONLY when user explicitly requests to update, change, modify, or edit an existing invoice with specific changes.',
    parameters: z.object({
      invoiceId: z.string().describe('The ID or Number of the invoice to update'),
      amount: z.number().optional().describe('Update the invoice total amount'),
      customer_name: z.string().optional().describe('Change the customer (must be existing customer)'),
      due_date: z.string().optional().describe('Update the due date (format: YYYY-MM-DD)'),
      description: z.string().optional().describe('Update the line item description/memo'),
      status: z.string().optional().describe('Update status'),
      paid: z.boolean().optional().describe('Mark as paid/unpaid'),
      balance: z.number().optional().describe('Update remaining balance'),
    }),
    execute: async ({ invoiceId, amount, customer_name, due_date, description, status, paid, balance }) => {
      try {
        console.log(`Updating invoice ${invoiceId} with parameters:`, { amount, customer_name, due_date, description, status, paid, balance });
        const qbo = await getQuickBooksClient();
        
        // First, validate invoice ID by searching all invoices for exact match
        console.log(`\n=== SEARCHING FOR EXACT INVOICE ID: ${invoiceId} ===`);
        
        // Get all invoices to find exact match
        const allInvoicesResult = await qbo.findInvoices({ limit: 1000 });
        let foundExactMatch = false;
        let exactInvoice = null;
        
        if (allInvoicesResult && (allInvoicesResult as any).QueryResponse?.Invoice) {
          const allInvoices = (allInvoicesResult as any).QueryResponse.Invoice;
          console.log(`Searching through ${allInvoices.length} invoices for exact ID match`);
          
          // Find exact ID match or DocNumber match
          exactInvoice = allInvoices.find((inv: any) => {
            const invoiceId_str = inv.Id ? inv.Id.toString() : '';
            const docNumber_str = inv.DocNumber ? inv.DocNumber.toString() : '';
            const requested_str = invoiceId.toString();
            console.log(`Comparing ID: "${invoiceId_str}" === "${requested_str}" ? ${invoiceId_str === requested_str}`);
            console.log(`Comparing DocNumber: "${docNumber_str}" === "${requested_str}" ? ${docNumber_str === requested_str}`);
            return invoiceId_str === requested_str || docNumber_str === requested_str;
          });
          
          foundExactMatch = !!exactInvoice;
        }
        
        if (!foundExactMatch) {
          console.log(`❌ NO EXACT MATCH FOUND for invoice ID: ${invoiceId}`);
          throw new Error(`Invoice with ID ${invoiceId} does not exist`);
        }
        
        console.log(`✅ EXACT MATCH FOUND: Invoice ID ${exactInvoice.Id}, DocNumber: ${exactInvoice.DocNumber}`);
        
        // Use the exact invoice we found
        const existingInvoice = exactInvoice;
        
        console.log(`Retrieved existing invoice: ${(existingInvoice as any).DocNumber}, ID: ${(existingInvoice as any).Id}`);
        console.log(`Current invoice balance: ${(existingInvoice as any).Balance}, Total: ${(existingInvoice as any).TotalAmt}`);
        
        // Create a copy of the existing invoice for updates
        const updatedInvoiceData = { ...(existingInvoice as any) };
        
        // Handle customer change if specified
        if (customer_name) {
          console.log(`Searching for customer: ${customer_name}`);
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
                console.log(`Found customer: ${customer.Name} (ID: ${customer.Id})`);
              }
            }
          } catch (error) {
            console.log(`Customer lookup failed: ${error}`);
          }
          
          if (!customer || !customer.Id) {
            throw new Error(`Customer "${customer_name}" not found. Please use an existing customer name.`);
          }
          
          updatedInvoiceData.CustomerRef = {
            value: customer.Id,
            name: customer.Name
          };
        }
        
        // Update due date if specified
        if (due_date) {
          updatedInvoiceData.DueDate = due_date;
        }
        
        // Update amount if specified
        if (amount) {
          // Update the first line item amount and recalculate totals
          if (updatedInvoiceData.Line && updatedInvoiceData.Line.length > 0) {
            updatedInvoiceData.Line[0].Amount = amount;
            // Update total amount to match
            updatedInvoiceData.TotalAmt = amount;
            // Balance will be recalculated by QuickBooks
          }
        }
        
        // Update description if specified
        if (description) {
          // Update the first line item description
          if (updatedInvoiceData.Line && updatedInvoiceData.Line.length > 0) {
            updatedInvoiceData.Line[0].Description = description;
          }
        }
        
        // Update balance if specified (treat as updating total amount since balance is auto-calculated)
        if (balance !== undefined) {
          console.log(`Updating balance from ${updatedInvoiceData.Balance} to ${balance}`);
          // In QuickBooks, balance is calculated as TotalAmt - payments
          // To set a specific balance, we need to update the total amount
          // and let QuickBooks recalculate the balance
          if (updatedInvoiceData.Line && updatedInvoiceData.Line.length > 0) {
            updatedInvoiceData.Line[0].Amount = balance;
            updatedInvoiceData.TotalAmt = balance;
          }
          // Force balance update (though QB might recalculate)
          updatedInvoiceData.Balance = balance;
        }
        
        // Handle paid status
        if (paid !== undefined) {
          if (paid) {
            // Mark as paid by setting balance to 0
            updatedInvoiceData.Balance = 0;
          } else {
            // Mark as unpaid - set balance to total amount
            updatedInvoiceData.Balance = updatedInvoiceData.TotalAmt || amount || balance || (updatedInvoiceData as any).Balance;
          }
        }
        
        // Handle status updates
        if (status) {
          if (status.toLowerCase().includes('void')) {
            updatedInvoiceData.void = true;
          }
          // Add other status handling as needed
        }
        
        // Log the data being sent to QuickBooks
        console.log(`Sending update to QuickBooks:`, {
          Id: updatedInvoiceData.Id,
          Balance: updatedInvoiceData.Balance,
          TotalAmt: updatedInvoiceData.TotalAmt,
          LineAmount: updatedInvoiceData.Line?.[0]?.Amount
        });
        
        // Update the invoice using SDK
        const updatedInvoice = await qbo.updateInvoice(updatedInvoiceData);
        console.log(`Successfully updated invoice ${invoiceId}`);
        
        // Verify the update was successful
        if (!updatedInvoice || !(updatedInvoice as any)?.Id) {
          throw new Error(`Invoice update failed - no response from QuickBooks`);
        }
        
        return updatedInvoice;
      } catch (error: any) {
        console.error(`Failed to update invoice ${invoiceId}:`, error);
        
        // Provide more specific error messages
        if (error.message && error.message.includes('does not exist')) {
          throw error; // Re-throw our custom error message
        }
        
        return handleSDKError(error);
      }
    },
  }),

  deleteInvoice: tool({
    description: 'Delete an invoice by ID or Number. Use ONLY when user explicitly requests to delete, remove, or cancel an invoice with a specific ID/Number. NOT for emailing or other actions.',
    parameters: z.object({
      invoiceId: z.string().describe('The ID or Number of the invoice to delete'),
    }),
    execute: async ({ invoiceId }) => {
      try {
        console.log(`Deleting invoice ${invoiceId} using SDK...`);
        const qbo = await getQuickBooksClient();
        
        // First try to get invoice by direct ID
        let existingInvoice = null;
        try {
          existingInvoice = await qbo.getInvoice(invoiceId);
          if (existingInvoice && (existingInvoice as any)?.Id) {
            const returnedId = (existingInvoice as any).Id;
            if (returnedId !== invoiceId && returnedId.toString() !== invoiceId) {
              existingInvoice = null; // ID mismatch
            }
          } else {
            existingInvoice = null;
          }
        } catch (directError: any) {
          existingInvoice = null;
        }
        
        // If direct ID lookup failed, search by DocNumber
        if (!existingInvoice) {
          const invoices = await qbo.findInvoices({ limit: 1000 });
          if (invoices && (invoices as any).QueryResponse?.Invoice) {
            const allInvoices = (invoices as any).QueryResponse.Invoice;
            const foundInvoice = allInvoices.find((inv: any) => {
              const docNumber = inv.DocNumber;
              return docNumber === invoiceId || docNumber?.toString() === invoiceId;
            });
            existingInvoice = foundInvoice;
          }
        }
        
        if (!existingInvoice || !(existingInvoice as any)?.Id) {
          throw new Error(`Invoice with ID/Number ${invoiceId} does not exist`);
        }
        
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
    description: 'Email an invoice PDF to a recipient. Use ONLY when user explicitly requests to email, send, or mail an invoice to a specific email address. NOT for deleting or other actions.',
    parameters: z.object({
      invoiceId: z.string().describe('The ID or Number of the invoice to email'),
      email: z.string().email().describe('Recipient email address'),
    }),
    execute: async ({ invoiceId, email }) => {
      try {
        console.log(`🔍 emailInvoicePdf: Starting email process for invoice ${invoiceId} to ${email}`);
        const qbo = await getQuickBooksClient();
        
        // First try to get invoice by direct ID
        console.log(`🔍 emailInvoicePdf: Verifying invoice ${invoiceId} exists...`);
        let invoice = null;
        try {
          invoice = await qbo.getInvoice(invoiceId);
          if (invoice && (invoice as any)?.Id) {
            const returnedId = (invoice as any).Id;
            if (returnedId !== invoiceId && returnedId.toString() !== invoiceId) {
              invoice = null; // ID mismatch
            }
          } else {
            invoice = null;
          }
        } catch (directError: any) {
          invoice = null;
        }
        
        // If direct ID lookup failed, search by DocNumber
        if (!invoice) {
          console.log(`🔍 emailInvoicePdf: Searching by DocNumber for ${invoiceId}...`);
          const invoices = await qbo.findInvoices({ limit: 1000 });
          if (invoices && (invoices as any).QueryResponse?.Invoice) {
            const allInvoices = (invoices as any).QueryResponse.Invoice;
            const foundInvoice = allInvoices.find((inv: any) => {
              const docNumber = inv.DocNumber;
              return docNumber === invoiceId || docNumber?.toString() === invoiceId;
            });
            invoice = foundInvoice;
          }
        }
        
        if (!invoice || !(invoice as any)?.Id) {
          console.log(`❌ emailInvoicePdf: Invoice ${invoiceId} not found`);
          throw new Error(`Invoice with ID/Number ${invoiceId} does not exist`);
        }
        
        const invoiceNumber = (invoice as any).DocNumber || invoiceId;
        const customerName = (invoice as any).CustomerRef?.name || 'Unknown Customer';
        console.log(`✅ emailInvoicePdf: Invoice found - #${invoiceNumber} for ${customerName}`);
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid email format: ${email}`);
        }
        
        console.log(`🔍 emailInvoicePdf: Attempting to send invoice PDF via QuickBooks API...`);
        
        // Try to send the invoice PDF
        let result;
        try {
          result = await qbo.sendInvoicePdf(invoiceId, email);
          console.log(`🔍 emailInvoicePdf: Raw result from sendInvoicePdf:`, result);
        } catch (apiError: any) {
          console.error(`❌ emailInvoicePdf: QuickBooks API error:`, apiError);
          
          // Check if it's a method not found error
          if (apiError.message && apiError.message.includes('sendInvoicePdf')) {
            console.log(`❌ emailInvoicePdf: sendInvoicePdf method not available in QuickBooks SDK`);
            throw new Error(`Email functionality is not available in the current QuickBooks integration. The sendInvoicePdf method is not supported by the QuickBooks SDK.`);
          }
          
          // Check for authentication errors
          if (apiError.message && (apiError.message.includes('Unauthorized') || apiError.message.includes('authentication'))) {
            throw new Error(`QuickBooks authentication failed. Please re-authenticate with QuickBooks.`);
          }
          
          // Check for permission errors
          if (apiError.message && apiError.message.includes('permission')) {
            throw new Error(`Insufficient permissions to send invoice emails. Please check your QuickBooks app permissions.`);
          }
          
          // For other API errors, provide more context
          throw new Error(`Failed to send invoice email: ${apiError.message || 'Unknown QuickBooks API error'}`);
        }
        
        // Verify the result indicates success
        if (!result) {
          console.log(`❌ emailInvoicePdf: No result returned from sendInvoicePdf`);
          throw new Error(`Email sending failed - no response from QuickBooks API`);
        }
        
        console.log(`✅ emailInvoicePdf: Invoice #${invoiceNumber} emailed to ${email} successfully`);
        
        // Return a success message with details
        return {
          success: true,
          message: `Invoice #${invoiceNumber} emailed to ${email} successfully`,
          invoiceId: invoiceId,
          invoiceNumber: invoiceNumber,
          customerName: customerName,
          recipient: email,
          timestamp: new Date().toISOString()
        };
        
      } catch (error: any) {
        console.error(`❌ emailInvoicePdf: Failed to email invoice ${invoiceId} to ${email}:`, error);
        
        // Return specific error messages for better user experience
        if (error.message.includes('does not exist')) {
          return { error: `Invoice #${invoiceId} was not found. It may have been deleted or is inactive.` };
        }
        
        if (error.message.includes('Invalid email format')) {
          return { error: `Invalid email address: ${email}. Please provide a valid email address.` };
        }
        
        if (error.message.includes('not available') || error.message.includes('not supported')) {
          return { error: `Email functionality is currently not available. Please manually send the invoice from QuickBooks.` };
        }
        
        return { error: error.message || 'Failed to send invoice email' };
      }
    },
  }),
}; 