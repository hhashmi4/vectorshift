import { NextResponse, type NextRequest } from "next/server";
import { localRequestAllowed } from "@/lib/server/local-request.ts";
import { computeRouteView, loadRoutingData } from "@/lib/server/route-service.ts";
import type { RouteRequestView, WebRoutingAlgorithm, WebTravelMode } from "@/lib/contracts.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRequest(value: unknown): value is RouteRequestView {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.start_node_id === "string" && candidate.start_node_id.length <= 256
    && typeof candidate.destination_node_id === "string" && candidate.destination_node_id.length <= 256
    && (["motor_vehicle", "bicycle", "pedestrian"] as readonly unknown[]).includes(candidate.mode as WebTravelMode)
    && (["dijkstra", "astar"] as readonly unknown[]).includes(candidate.algorithm as WebRoutingAlgorithm);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!localRequestAllowed(request)) return NextResponse.json({ status: "error", message: "Phase 1C routing is local-only." }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Expected a JSON route request." }, { status: 400 });
  }
  if (!isRequest(body)) return NextResponse.json({ status: "error", message: "Invalid route request." }, { status: 400 });
  try {
    const result = computeRouteView(await loadRoutingData(), body);
    return NextResponse.json(result, { status: result.status === "unsupported" ? 422 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Routing failed.";
    const status = message.startsWith("unknown ") ? 400 : 500;
    return NextResponse.json({ status: "error", message }, { status });
  }
}
