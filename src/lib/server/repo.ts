// Data access for users, companies and decisions. Every query is scoped by companyId.
import "server-only";
import { ObjectId, type WithId } from "mongodb";
import { demoCompany, demoFinancing } from "@/lib/demoData";
import { isShariahCompliant } from "@/lib/finance";
import type {
  Company,
  CompanyRecord,
  DecisionPatch,
  DecisionRecord,
  DecisionStatus,
  FinancingOption,
  FinancingPreference,
} from "@/lib/types";
import { getDb } from "./db";

export type UserDoc = {
  email: string;
  name: string;
  passwordHash: string;
  companyId: ObjectId;
  createdAt: Date;
};

// Docs written before Islamic finance support lack financingPreference and FinancingOption.shariahCompliant.
type CompanyDoc = Omit<Company, "financingPreference"> & {
  financingPreference?: FinancingPreference;
  ownerId: ObjectId;
  financing: (Omit<FinancingOption, "shariahCompliant"> & { shariahCompliant?: boolean })[];
  updatedAt: Date;
};

type DecisionDoc = Omit<DecisionRecord, "id" | "createdAt" | "updatedAt" | "decidedAt"> & {
  companyId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  decidedAt: Date | null;
};

function toId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

// ---- users ----

export async function findUserByEmail(email: string): Promise<WithId<UserDoc> | null> {
  const db = await getDb();
  return db.collection<UserDoc>("users").findOne({ email: email.trim().toLowerCase() });
}

export async function findUserById(id: string): Promise<WithId<UserDoc> | null> {
  const _id = toId(id);
  if (!_id) return null;
  const db = await getDb();
  return db.collection<UserDoc>("users").findOne({ _id });
}

// Creates the user and their company in one go. Throws on duplicate email (unique index).
export async function createUserWithCompany(input: {
  email: string;
  name: string;
  passwordHash: string;
  company?: Partial<Company>;
}): Promise<WithId<UserDoc>> {
  const db = await getDb();
  const userId = new ObjectId();
  const companyId = new ObjectId();
  const company: CompanyDoc = {
    ...demoCompany,
    ...input.company,
    ownerId: userId,
    financing: demoFinancing,
    updatedAt: new Date(),
  };
  await db.collection<CompanyDoc>("companies").insertOne({ _id: companyId, ...company });
  const user: UserDoc = {
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    passwordHash: input.passwordHash,
    companyId,
    createdAt: new Date(),
  };
  await db.collection<UserDoc>("users").insertOne({ _id: userId, ...user });
  return { _id: userId, ...user };
}

// ---- company ----

// Old company docs: options are classified by type (bank/ltff = conventional). A doc saved before the preference
// existed that has no Shariah-compliant option gets the Islamic defaults added in front of its own options, so it
// opens Islamic-first without losing anything; nothing is written until the owner saves.
export function normaliseCompanyFinancing(doc: Pick<CompanyDoc, "financing" | "financingPreference">): {
  financing: FinancingOption[];
  financingPreference: FinancingPreference;
} {
  const own: FinancingOption[] = (doc.financing ?? demoFinancing).map((f) => ({ ...f, shariahCompliant: isShariahCompliant(f) }));
  if (doc.financingPreference) return { financing: own, financingPreference: doc.financingPreference };
  const islamicDefaults = demoFinancing.filter((f) => f.shariahCompliant && !own.some((o) => o.id === f.id));
  const financing = own.some((f) => f.shariahCompliant) ? own : [...islamicDefaults, ...own];
  return { financing, financingPreference: "islamic" };
}

function companyRecord(doc: WithId<CompanyDoc>): CompanyRecord {
  const { financing, financingPreference } = normaliseCompanyFinancing(doc);
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    city: doc.city,
    isExporter: doc.isExporter,
    cashBalance: doc.cashBalance,
    monthlyFixedCosts: doc.monthlyFixedCosts,
    taxRate: doc.taxRate,
    discountRate: doc.discountRate,
    financingPreference,
    payInFullWhenAffordable: doc.payInFullWhenAffordable ?? false,
    financing,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getCompany(companyId: string): Promise<CompanyRecord | null> {
  const _id = toId(companyId);
  if (!_id) return null;
  const db = await getDb();
  const doc = await db.collection<CompanyDoc>("companies").findOne({ _id });
  return doc ? companyRecord(doc) : null;
}

export type CompanyPatch = Partial<Company> & { financing?: FinancingOption[] };

export async function updateCompany(companyId: string, patch: CompanyPatch): Promise<CompanyRecord | null> {
  const _id = toId(companyId);
  if (!_id) return null;
  const allowed: (keyof CompanyPatch)[] = [
    "name",
    "city",
    "isExporter",
    "cashBalance",
    "monthlyFixedCosts",
    "taxRate",
    "discountRate",
    "financingPreference",
    "payInFullWhenAffordable",
    "financing",
  ];
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) if (patch[key] !== undefined) set[key] = patch[key];
  const db = await getDb();
  // First preference save on an old doc: persist the financing it was shown with (Islamic defaults included).
  if (patch.financingPreference !== undefined && patch.financing === undefined) {
    const current = await db.collection<CompanyDoc>("companies").findOne({ _id });
    if (current && !current.financingPreference) set.financing = normaliseCompanyFinancing(current).financing;
  }
  const doc = await db
    .collection<CompanyDoc>("companies")
    .findOneAndUpdate({ _id }, { $set: set }, { returnDocument: "after" });
  return doc ? companyRecord(doc) : null;
}

// ---- decisions ----

export function deriveStatus(d: Pick<DecisionRecord, "quotationConfirmed" | "offers" | "decision" | "memo">): DecisionStatus {
  if (d.memo) return "decided";
  if (d.decision) return "comparing";
  if (d.quotationConfirmed || d.offers.length > 0) return "collecting";
  return "draft";
}

function decisionRecord(doc: WithId<DecisionDoc>): DecisionRecord {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    status: doc.status,
    origin: doc.origin === "need" ? "need" : "quotation",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    decidedAt: doc.decidedAt ? doc.decidedAt.toISOString() : null,
    quotation: doc.quotation ?? null,
    quotationConfirmed: doc.quotationConfirmed ?? false,
    sourcing: doc.sourcing ?? null,
    offers: doc.offers ?? [],
    market: doc.market ?? null,
    reputations: doc.reputations ?? {},
    suppliers: doc.suppliers ?? [],
    emails: doc.emails ?? [],
    decision: doc.decision ?? null,
    memo: doc.memo ?? null,
    paymentConfirmations: doc.paymentConfirmations ?? [],
  };
}

export async function listDecisions(companyId: string): Promise<DecisionRecord[]> {
  const _id = toId(companyId);
  if (!_id) return [];
  const db = await getDb();
  const docs = await db.collection<DecisionDoc>("decisions").find({ companyId: _id }).sort({ updatedAt: -1 }).toArray();
  return docs.map(decisionRecord);
}

export async function getDecision(companyId: string, id: string): Promise<DecisionRecord | null> {
  const companyObjectId = toId(companyId);
  const _id = toId(id);
  if (!companyObjectId || !_id) return null;
  const db = await getDb();
  const doc = await db.collection<DecisionDoc>("decisions").findOne({ _id, companyId: companyObjectId });
  return doc ? decisionRecord(doc) : null;
}

export async function createDecision(
  companyId: string,
  init: DecisionPatch & { title: string },
  dates?: { createdAt?: Date; decidedAt?: Date | null },
): Promise<DecisionRecord> {
  const companyObjectId = toId(companyId);
  if (!companyObjectId) throw new Error("Invalid company id");
  const base = {
    title: init.title,
    origin: init.origin ?? "quotation",
    quotation: init.quotation ?? null,
    quotationConfirmed: init.quotationConfirmed ?? false,
    sourcing: init.sourcing ?? null,
    offers: init.offers ?? [],
    market: init.market ?? null,
    reputations: init.reputations ?? {},
    suppliers: init.suppliers ?? [],
    emails: init.emails ?? [],
    decision: init.decision ?? null,
    memo: init.memo ?? null,
    paymentConfirmations: init.paymentConfirmations ?? [],
  };
  const now = dates?.createdAt ?? new Date();
  const status = deriveStatus(base);
  const doc: DecisionDoc = {
    ...base,
    status,
    companyId: companyObjectId,
    createdAt: now,
    updatedAt: now,
    decidedAt: status === "decided" ? (dates?.decidedAt ?? now) : null,
  };
  const db = await getDb();
  const result = await db.collection<DecisionDoc>("decisions").insertOne(doc);
  return decisionRecord({ _id: result.insertedId, ...doc });
}

const PATCHABLE: (keyof DecisionPatch)[] = [
  "title",
  "origin",
  "quotation",
  "quotationConfirmed",
  "sourcing",
  "offers",
  "market",
  "reputations",
  "suppliers",
  "emails",
  "decision",
  "memo",
  "paymentConfirmations",
];

export async function updateDecision(companyId: string, id: string, patch: DecisionPatch): Promise<DecisionRecord | null> {
  const current = await getDecision(companyId, id);
  if (!current) return null;
  const next = { ...current };
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of PATCHABLE) {
    if (patch[key] !== undefined) {
      set[key] = patch[key];
      (next as Record<string, unknown>)[key] = patch[key];
    }
  }
  const status = deriveStatus(next);
  set.status = status;
  if (status === "decided" && !current.decidedAt) set.decidedAt = new Date();
  if (status !== "decided") set.decidedAt = null;
  const db = await getDb();
  const doc = await db
    .collection<DecisionDoc>("decisions")
    .findOneAndUpdate({ _id: new ObjectId(id), companyId: new ObjectId(companyId) }, { $set: set }, { returnDocument: "after" });
  return doc ? decisionRecord(doc) : null;
}

export async function deleteDecision(companyId: string, id: string): Promise<boolean> {
  const companyObjectId = toId(companyId);
  const _id = toId(id);
  if (!companyObjectId || !_id) return false;
  const db = await getDb();
  const result = await db.collection<DecisionDoc>("decisions").deleteOne({ _id, companyId: companyObjectId });
  return result.deletedCount === 1;
}
