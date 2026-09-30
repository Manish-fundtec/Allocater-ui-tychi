import { AuthError } from "@/lib/auth";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonError(error: unknown, fallback = "Internal server error") {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}
