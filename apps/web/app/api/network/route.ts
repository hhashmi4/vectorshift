import { NextResponse, type NextRequest } from "next/server";
import { localRequestAllowed } from "@/lib/server/local-request.ts";
import { networkView } from "@/lib/server/route-service.ts";
import type { WebTravelMode } from "@/lib/contracts.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!localRequestAllowed(request)) return NextResponse.json({ status: "error", message: "Phase 1C routing is local-only." }, { status: 403 });
  const mode = request.nextUrl.searchParams.get("mode") ?? "motor_vehicle";
  if (!(["motor_vehicle", "bicycle", "pedestrian"] as const).includes(mode as WebTravelMode)) {
    return NextResponse.json({ status: "error", message: "Unsupported travel mode." }, { status: 400 });
  }
  try {
    return NextResponse.json(await networkView(mode as WebTravelMode), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ status: "error", message: error instanceof Error ? error.message : "Graph artifact unavailable." }, { status: 503 });
  }
}
