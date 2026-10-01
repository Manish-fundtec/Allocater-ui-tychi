import { callExpress } from "@/server/express-adapter";
import { getAllocatorApp } from "@/server/allocator-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  try {
    const app = await getAllocatorApp();
    return await callExpress(app, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "API failed to start";
    return Response.json({ error: message }, { status: 500 });
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}

export function PUT(request: Request) {
  return handle(request);
}

export function PATCH(request: Request) {
  return handle(request);
}

export function DELETE(request: Request) {
  return handle(request);
}

export function HEAD(request: Request) {
  return handle(request);
}

export function OPTIONS(request: Request) {
  return handle(request);
}
