import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksClient, handleSDKError } from '../../../../lib/quickbooksClient';

export async function GET(req: NextRequest) {
  try {
    console.log('Retrieving company info using SDK...');
    const qbo = await getQuickBooksClient();
    
    // Use SDK to get company info
    // Note: getCompanyInfo typically needs the company ID, but SDK might handle this automatically
    const companyInfo = await qbo.getCompanyInfo('1'); // '1' is typically the default company ID
    
    console.log('Successfully retrieved company info:', (companyInfo as any)?.Name);
    return NextResponse.json({ companyInfo });
  } catch (error: any) {
    console.error('Failed to retrieve company info:', error);
    const errorResponse = handleSDKError(error);
    return NextResponse.json(errorResponse, { status: 400 });
  }
} 