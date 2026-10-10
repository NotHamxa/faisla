// GET → all decisions for the company (newest first); POST { title } → new draft decision.
import { z } from "zod";
import { userOr401 } from "@/lib/auth/session";
import { createDecision, listDecisions } from "@/lib/server/repo";

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  return Response.json({ decisions: await listDecisions(user.companyId) });
}

export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const parsed = z.object({ title: z.string().trim().min(1).max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Title is required" }, { status: 400 });
  const decision = await createDecision(user.companyId, { title: parsed.data.title });
  return Response.json({ decision }, { status: 201 });
}
