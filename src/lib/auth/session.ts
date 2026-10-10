// Database-backed sessions: a random token in an httpOnly cookie, its SHA-256 stored in Mongo.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/server/db";
import { findUserById } from "@/lib/server/repo";
import type { SessionUser } from "@/lib/types";
import { SESSION_COOKIE, SESSION_DAYS } from "./constants";

type SessionDoc = { tokenHash: string; userId: ObjectId; createdAt: Date; expiresAt: Date };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: ObjectId): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = await getDb();
  await db.collection<SessionDoc>("sessions").insertOne({ tokenHash: hashToken(token), userId, createdAt: new Date(), expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

// Returns the signed-in user, or null. Safe to call from server components, actions and route handlers.
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const session = await db.collection<SessionDoc>("sessions").findOne({ tokenHash: hashToken(token) });
  if (!session || session.expiresAt < new Date()) return null;
  const user = await findUserById(session.userId.toHexString());
  if (!user) return null;
  return { id: user._id.toHexString(), name: user.name, email: user.email, companyId: user.companyId.toHexString() };
}

// For pages and server actions: redirects to /login when signed out.
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.collection<SessionDoc>("sessions").deleteOne({ tokenHash: hashToken(token) });
  }
  store.delete(SESSION_COOKIE);
}

// For route handlers: the user or a 401 response.
export async function userOr401(): Promise<SessionUser | Response> {
  const user = await getSessionUser();
  return user ?? Response.json({ error: "Not signed in" }, { status: 401 });
}
