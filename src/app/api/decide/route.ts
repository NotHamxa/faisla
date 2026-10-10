// POST /api/decide: company + offers + financing → comparison JSON. All maths in lib/finance.ts (no AI).
import { apiUser } from "@/lib/auth/api";
import { z } from "zod";
import { decide, isIslamicType } from "@/lib/finance";
import type { DecideInput } from "@/lib/types";

const money = z.number().finite().nonnegative();
const rate = z.number().finite().min(0).max(1);

const companySchema = z.object({
  name: z.string(),
  city: z.string(),
  isExporter: z.boolean(),
  cashBalance: z.number().finite(),
  monthlyFixedCosts: z.number().finite().positive(),
  taxRate: rate,
  discountRate: rate,
  financingPreference: z.enum(["islamic", "both"]).default("islamic"),
});

const offerSchema = z.object({
  id: z.string().min(1),
  supplierName: z.string(),
  supplierEmail: z.string().nullable(),
  item: z.string(),
  model: z.string().nullable(),
  qty: z.number().positive(),
  unitPrice: money,
  total: z.number().finite().positive(),
  cashDiscountPct: z.number().min(0).max(100).nullable(),
  installmentMonths: z.number().int().positive().nullable(),
  installmentAmount: money.nullable(),
  firstInstallmentOnDelivery: z.boolean(),
  source: z.enum(["quote", "email", "web"]),
  sourceLink: z.string().nullable(),
  receivedAt: z.string(),
  deliveryDays: z.number().nullable().optional(),
  warrantyMonths: z.number().nullable().optional(),
  summary: z.string().nullable().optional(),
});

const financingSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(["diminishing_musharakah", "murabaha", "ijarah", "iltf", "bank", "ltff"]),
  shariahCompliant: z.boolean().optional(),
  annualRate: rate,
  tenorMonths: z.number().int().positive(),
  downPaymentPct: rate,
  feePct: rate,
  kiborLinked: z.boolean(),
  requiresExporter: z.boolean(),
  sourceLink: z.string().nullable(),
  note: z.string().optional(),
}).transform((f) => ({ ...f, shariahCompliant: f.shariahCompliant ?? isIslamicType(f.type) }));

const decideInputSchema = z.object({
  company: companySchema,
  offers: z.array(offerSchema).min(1, "at least one offer is needed"),
  financing: z.array(financingSchema),
  kiborShift: z.number().min(-0.1).max(0.1).optional(),
  preference: z.enum(["islamic", "both"]).optional(),
});

export async function POST(request: Request) {
  const authed = await apiUser(request);
  if (authed instanceof Response) return authed;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = decideInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", issues: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const input: DecideInput = parsed.data;
  return Response.json(decide(input));
}
