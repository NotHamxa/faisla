// GET → the signed-in user's company; PATCH → update profile and/or financing options.
import { z } from "zod";
import { userOr401 } from "@/lib/auth/session";
import { isIslamicType } from "@/lib/finance";
import { getCompany, updateCompany } from "@/lib/server/repo";

const financingSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["diminishing_musharakah", "murabaha", "ijarah", "iltf", "bank", "ltff"]),
  // Options saved before the flag existed are classified by type.
  shariahCompliant: z.boolean().optional(),
  annualRate: z.number().min(0).max(1),
  tenorMonths: z.number().int().min(1).max(240),
  downPaymentPct: z.number().min(0).max(1),
  feePct: z.number().min(0).max(1),
  kiborLinked: z.boolean(),
  requiresExporter: z.boolean(),
  sourceLink: z.string().nullable(),
  note: z.string().optional(),
}).transform((f) => ({ ...f, shariahCompliant: f.shariahCompliant ?? isIslamicType(f.type) }));

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  city: z.string().optional(),
  isExporter: z.boolean().optional(),
  cashBalance: z.number().min(0).optional(),
  monthlyFixedCosts: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  discountRate: z.number().min(0).max(1).optional(),
  financingPreference: z.enum(["islamic", "both"]).optional(),
  payInFullWhenAffordable: z.boolean().optional(),
  financing: z.array(financingSchema).optional(),
});

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  return Response.json({ company: await getCompany(user.companyId) });
}

export async function PATCH(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const company = await updateCompany(user.companyId, parsed.data);
  return company ? Response.json({ company }) : Response.json({ error: "Not found" }, { status: 404 });
}
