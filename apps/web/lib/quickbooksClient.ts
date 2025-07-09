import QuickBooks from 'node-quickbooks';
import { getQuickBooksTokens } from './quickbooksTokens';

// Helper function to promisify QuickBooks SDK callback methods
function promisify<T>(fn: Function, context: any): (...args: any[]) => Promise<T> {
  return (...args: any[]): Promise<T> => {
    return new Promise((resolve, reject) => {
      fn.call(context, ...args, (err: any, result: T) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };
}

export async function getQuickBooksClient() {
  console.log('🔍 QuickBooks Client: Starting authentication check...');
  
  const tokens = await getQuickBooksTokens();
  console.log('🔍 QuickBooks Client: Tokens retrieved:', {
    hasTokens: !!tokens,
    hasAccessToken: !!tokens?.access_token,
    hasRealmId: !!tokens?.realmId,
    hasRefreshToken: !!tokens?.refresh_token,
    realmId: tokens?.realmId
  });
  
  if (!tokens || !tokens.access_token || !tokens.realmId) {
    console.error('❌ QuickBooks Client: Authentication failed - missing tokens');
    throw new Error('QuickBooks not authenticated');
  }

  const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
  const useSandbox = environment === 'sandbox';
  
  console.log('🔍 QuickBooks Client: Environment config:', {
    environment,
    useSandbox,
    hasClientId: !!process.env.QUICKBOOKS_CLIENT_ID,
    hasClientSecret: !!process.env.QUICKBOOKS_CLIENT_SECRET,
    nodeEnv: process.env.NODE_ENV
  });

  // Initialize QuickBooks SDK client
  const qbo = new QuickBooks(
    process.env.QUICKBOOKS_CLIENT_ID!,
    process.env.QUICKBOOKS_CLIENT_SECRET!,
    tokens.access_token,
    false, // OAuth 2.0 doesn't use token secret
    tokens.realmId,
    useSandbox,
    process.env.NODE_ENV === 'development',
    75, // Minor version for latest API
    '2.0', // OAuth version
    tokens.refresh_token
  );
  
  console.log('🔍 QuickBooks Client: SDK client initialized successfully');

  // Create promisified versions of the methods we need
  return {
    getInvoice: promisify(qbo.getInvoice, qbo),
    findInvoices: promisify(qbo.findInvoices, qbo),
    createInvoice: promisify(qbo.createInvoice, qbo),
    updateInvoice: promisify(qbo.updateInvoice, qbo),
    deleteInvoice: promisify(qbo.deleteInvoice, qbo),
    sendInvoicePdf: promisify(qbo.sendInvoicePdf, qbo),
    getCompanyInfo: promisify(qbo.getCompanyInfo, qbo),
  };
}

// Helper function to handle SDK errors consistently
export function handleSDKError(error: any): { error: string } {
  console.error('QuickBooks SDK Error:', error);
  
  if (error?.Fault?.Error?.[0]?.Detail) {
    return { error: error.Fault.Error[0].Detail };
  } else if (error?.Fault?.Error?.[0]?.Message) {
    return { error: error.Fault.Error[0].Message };
  } else if (error?.message) {
    return { error: error.message };
  } else {
    return { error: 'Unknown QuickBooks error occurred' };
  }
} 