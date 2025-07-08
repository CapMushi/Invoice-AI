declare module 'node-quickbooks' {
  type Callback<T> = (err: any, result?: T) => void;

  class QuickBooks {
    constructor(
      consumerKey: string,
      consumerSecret: string,
      accessToken: string,
      accessTokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug?: boolean,
      minorVersion?: number,
      oAuthVersion?: string,
      refreshToken?: string
    );
    
    // Invoice methods with callbacks
    getInvoice(id: string, callback: Callback<any>): void;
    findInvoices(criteria: any, callback: Callback<any>): void;
    createInvoice(invoice: any, callback: Callback<any>): void;
    updateInvoice(invoice: any, callback: Callback<any>): void;
    deleteInvoice(idOrEntity: string | any, callback: Callback<any>): void;
    sendInvoicePdf(id: string, sendTo: string, callback: Callback<any>): void;
    
    // Company info
    getCompanyInfo(id: string, callback: Callback<any>): void;
    
    // Add other methods as needed
    [key: string]: any;
  }

  export = QuickBooks;
} 