import { cookies } from "next/headers";
import { getQuickBooksTokens as getTokensFromDB } from './supabase/auth';

export async function getQuickBooksTokens() {
  try {
    // First try to get tokens from database (for authenticated users)
    const cookieStore = await cookies();
    console.log("🔍 Token retrieval: Cookie store accessed");

    // Check if we have a user session
    const authCookie = cookieStore.get("sb-access-token");
    if (authCookie) {
      console.log("🔍 Token retrieval: Found auth session, trying database");
      // TODO: Extract user ID from session and get tokens from database
      // For now, fall back to cookie method
    }

    // Fallback to cookie method
    const cookie = cookieStore.get("quickbooks_tokens");
    console.log("🔍 Token retrieval: Cookie retrieved:", {
      exists: !!cookie,
      name: cookie?.name,
      hasValue: !!cookie?.value,
    });

    if (!cookie || !cookie.value) {
      console.log("🔍 Token retrieval: No cookie found");
      return null;
    }

    const parsed = JSON.parse(cookie.value);
    console.log("🔍 Token retrieval: Parsed tokens:", {
      hasAccessToken: !!parsed.access_token,
      hasRefreshToken: !!parsed.refresh_token,
      hasRealmId: !!parsed.realmId,
      realmId: parsed.realmId,
    });

    return parsed;
  } catch (error) {
    console.error("❌ Token retrieval error:", error);
    return null;
  }
}
