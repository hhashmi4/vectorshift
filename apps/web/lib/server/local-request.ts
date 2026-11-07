import type { NextRequest } from "next/server";

export function localRequestAllowed(request: NextRequest): boolean {
  if (process.env.VECTORSHIFT_ALLOW_NONLOCAL === "1") return true;
  const hostname = request.nextUrl.hostname.toLowerCase();
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}
