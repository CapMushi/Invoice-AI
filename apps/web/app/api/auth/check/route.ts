import { NextRequest, NextResponse } from "next/server";
import { getQuickBooksTokens } from "../../../../lib/quickbooksTokens";

export async function POST(req: NextRequest) {
  try {
    console.log(
      "🔍 Auth Check: Checking both cookie and localStorage tokens...",
    );

    // First try to get tokens from cookies (server-side)
    let tokens = await getQuickBooksTokens();

    if (!tokens) {
      // If no cookie tokens, try to get from request body (localStorage tokens)
      const body = await req.json();
      if (body.tokens) {
        console.log("🔍 Auth Check: Using localStorage tokens from client");
        tokens = body.tokens;

        // Validate token structure
        if (!tokens.access_token || !tokens.realmId) {
          return NextResponse.json({
            authenticated: false,
            error: "Invalid token structure",
          });
        }
      }
    }

    if (!tokens) {
      return NextResponse.json({
        authenticated: false,
        error: "No tokens found",
      });
    }

    console.log("🔍 Auth Check: Tokens found, checking with QuickBooks...");

    // Try to use the tokens to make a simple QuickBooks API call
    const response = await fetch(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${tokens.realmId}/companyinfo/1?minorversion=75`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: "application/json",
        },
      },
    );

    if (response.ok) {
      console.log("✅ Auth Check: QuickBooks API call successful");
      return NextResponse.json({
        authenticated: true,
        realmId: tokens.realmId,
      });
    } else {
      console.log(
        "❌ Auth Check: QuickBooks API call failed:",
        response.status,
      );
      return NextResponse.json({
        authenticated: false,
        error: "Token validation failed",
      });
    }
  } catch (error) {
    console.error("❌ Auth Check: Error:", error);
    return NextResponse.json(
      {
        authenticated: false,
        error: "Authentication check failed",
      },
      { status: 500 },
    );
  }
}
