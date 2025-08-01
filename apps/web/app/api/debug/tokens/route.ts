import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  console.log("🔍 Debug: Checking cookies...");
  console.log("🔍 Debug: Request URL:", req.url);
  console.log(
    "🔍 Debug: Request headers:",
    Object.fromEntries(req.headers.entries()),
  );

  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const qbCookie = cookieStore.get("quickbooks_tokens");

    console.log(
      "🔍 Debug: All cookies:",
      allCookies.map((c) => ({ name: c.name, hasValue: !!c.value })),
    );
    console.log(
      "🔍 Debug: QB cookie:",
      qbCookie
        ? { name: qbCookie.name, hasValue: !!qbCookie.value }
        : "not found",
    );

    return NextResponse.json({
      allCookies: allCookies.map((c) => ({
        name: c.name,
        hasValue: !!c.value,
      })),
      quickbooksToken: qbCookie
        ? {
            name: qbCookie.name,
            hasValue: !!qbCookie.value,
            valueLength: qbCookie.value?.length || 0,
          }
        : null,
      requestHeaders: Object.fromEntries(req.headers.entries()),
    });
  } catch (error) {
    console.error("❌ Debug: Error:", error);
    return NextResponse.json(
      { error: "Failed to check cookies" },
      { status: 500 },
    );
  }
}
