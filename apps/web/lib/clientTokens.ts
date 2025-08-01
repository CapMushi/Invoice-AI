// Client-side token management using localStorage as fallback

export interface TokenData {
  access_token: string;
  refresh_token: string;
  realmId: string;
  expires_in?: number;
  token_type?: string;
}

export function storeTokensClient(tokens: TokenData): void {
  try {
    localStorage.setItem("quickbooks_tokens", JSON.stringify(tokens));
    console.log("✅ Client: Tokens stored in localStorage");
  } catch (error) {
    console.error("❌ Client: Failed to store tokens:", error);
  }
}

export function getTokensClient(): TokenData | null {
  try {
    const tokens = localStorage.getItem("quickbooks_tokens");
    if (!tokens) {
      console.log("🔍 Client: No tokens in localStorage");
      return null;
    }

    const parsed = JSON.parse(tokens);
    console.log("🔍 Client: Retrieved tokens from localStorage:", {
      hasAccessToken: !!parsed.access_token,
      hasRefreshToken: !!parsed.refresh_token,
      hasRealmId: !!parsed.realmId,
      realmId: parsed.realmId,
    });

    return parsed;
  } catch (error) {
    console.error("❌ Client: Failed to retrieve tokens:", error);
    return null;
  }
}

export function clearTokensClient(): void {
  try {
    localStorage.removeItem("quickbooks_tokens");
    console.log("✅ Client: Tokens cleared from localStorage");
  } catch (error) {
    console.error("❌ Client: Failed to clear tokens:", error);
  }
}
