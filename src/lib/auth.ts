import { NextRequest } from "next/server";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function getSessionUser(
  request: NextRequest,
): Promise<SessionUser | null> {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    if (token) {
      return {
        id: "user-1",
        name: "Rahul A.",
        email: "rahul@fundtec.example",
        role: "Fund Manager",
      };
    }
  }

  const cookie = request.cookies.get("fundtec_session")?.value;
  if (cookie) {
    return {
      id: "user-1",
      name: "Rahul A.",
      email: "rahul@fundtec.example",
      role: "Fund Manager",
    };
  }

  if (process.env.NODE_ENV === "development") {
    return {
      id: "user-1",
      name: "Rahul A.",
      email: "rahul@fundtec.example",
      role: "Fund Manager",
    };
  }

  return null;
}

export async function requireAuth(request: NextRequest): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) {
    throw new AuthError("Unauthorized");
  }
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
