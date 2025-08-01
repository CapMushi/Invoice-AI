import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  console.log("🔍 Simple callback test hit!");
  console.log("🔍 URL:", req.url);

  return NextResponse.json({
    message: "Callback route is working!",
    url: req.url,
    timestamp: new Date().toISOString(),
  });
}
