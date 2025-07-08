import { cookies } from 'next/headers';

export async function getQuickBooksTokens() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('quickbooks_tokens');
  if (!cookie) return null;
  try {
    return JSON.parse(cookie.value);
  } catch {
    return null;
  }
} 