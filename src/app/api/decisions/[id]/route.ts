// GET / PATCH / DELETE one decision. PATCH takes any DecisionPatch fields (the client store autosaves).
import { userOr401 } from "@/lib/auth/session";
import { deleteDecision, getDecision, updateDecision } from "@/lib/server/repo";
import type { DecisionPatch } from "@/lib/types";

export async function GET(_request: Request, ctx: RouteContext<"/api/decisions/[id]">) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const decision = await getDecision(user.companyId, (await ctx.params).id);
  return decision ? Response.json({ decision }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/decisions/[id]">) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = (await request.json().catch(() => null)) as DecisionPatch | null;
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid body" }, { status: 400 });
  const decision = await updateDecision(user.companyId, (await ctx.params).id, body);
  return decision ? Response.json({ decision }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/decisions/[id]">) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const ok = await deleteDecision(user.companyId, (await ctx.params).id);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}
