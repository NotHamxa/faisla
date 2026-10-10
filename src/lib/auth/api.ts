// Auth for API route handlers: a real (database-checked) session, or an in-process internal call
// (the demo seed and the live benchmark scripts call route handlers directly, without a browser session).
import "server-only";
import { randomBytes } from "node:crypto";
import type { SessionUser } from "@/lib/types";
import { userOr401 } from "./session";

const globalForAuth = globalThis as unknown as { faislaInternalToken?: string };
// Random per server process, never sent to a browser.
export const INTERNAL_TOKEN = (globalForAuth.faislaInternalToken ??= randomBytes(24).toString("hex"));
export const INTERNAL_HEADER = "x-faisla-internal";

export async function apiUser(request: Request): Promise<SessionUser | "internal" | Response> {
  if (request.headers.get(INTERNAL_HEADER) === INTERNAL_TOKEN) return "internal";
  return userOr401();
}
