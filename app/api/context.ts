import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export type AuthSessionData = {
  employeeId: string;
  role: "admin" | "manager" | "staff";
  branchCode: string;
  fullName: string;
} | null;

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user: AuthSessionData;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const req = opts.req;
  const authHeader = req.headers.get("x-dunkin-auth") || req.headers.get("authorization") || "";

  let user: AuthSessionData = null;
  if (authHeader) {
    try {
      const raw = authHeader.replace(/^Bearer\s+/i, "");
      const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
      if (decoded && decoded.employeeId && decoded.role) {
        user = {
          employeeId: String(decoded.employeeId),
          role: decoded.role,
          branchCode: String(decoded.branchCode || ""),
          fullName: String(decoded.fullName || ""),
        };
      }
    } catch (e) {
      // Invalid auth token
    }
  }

  return { req: opts.req, resHeaders: opts.resHeaders, user };
}
