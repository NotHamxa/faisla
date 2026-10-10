// POST /api/decide: company + offers + financing → comparison JSON. All maths in lib/finance.ts (no AI).
import { z } from "zod";
import { decide } from "@/lib/finance";
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
  type: z.enum(["bank", "ltff"]),
  annualRate: rate,
  tenorMonths: z.number().int().positive(),
  downPaymentPct: rate,
  feePct: rate,
  kiborLinked: z.boolean(),
  requiresExporter: z.boolean(),
  sourceLink: z.string().nullable(),
  note: z.string().optional(),
});

const decideInputSchema = z.object({
  company: companySchema,
  offers: z.array(offerSchema).min(1, "at least one offer is needed"),
  financing: z.array(financingSchema),
  kiborShift: z.number().min(-0.1).max(0.1).optional(),
});

export async function POST(request: Request) {
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
