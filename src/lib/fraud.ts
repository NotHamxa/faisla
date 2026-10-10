// Payment-fraud check (spec §8): code rules, no AI. Catches the classic "please pay to our new account"
// email (business email compromise / invoice fraud) by comparing bank details and senders against what is on file.
import type { EmailRecord, PaymentDetails, Quotation } from "./types";

export type RiskLevel = "high" | "medium" | "low";

export type PaymentRisk = {
  id: string; // email id, or "quotation"
  emailId: string | null;
  supplierName: string;
  level: RiskLevel;
  reasons: string[];
  iban: string | null;
  confirmed: boolean; // owner confirmed the account by phone on a known number
};

const FREE_MAIL = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "aol.com", "icloud.com", "proton.me", "protonmail.com", "ymail.com"];

// ---- IBAN ----

export function normalizeIban(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}

// Pakistani IBAN: PK + 2 check digits + 4-letter bank code + 16 digits (24 chars), ISO 13616 mod-97.
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^PK\d{2}[A-Z]{4}\d{16}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

const IBAN_RE = /\bPK\s?\d{2}(?:[\s-]?[A-Z0-9]){20}\b/gi;

export function findIbans(text: string): string[] {
  return [...new Set((text.match(IBAN_RE) ?? []).map(normalizeIban))];
}

// ---- language and names ----

const CHANGE_OR_URGENCY = [
  /account (?:has |have )?(?:been )?chang/i,
  /chang\w* (?:of |in )?(?:our |the )?(?:bank )?account/i,
  /new (?:bank )?account/i,
  /updated? (?:bank )?(?:account|details)/i,
  /(?:old|previous) account (?:is )?(?:closed|blocked|frozen|not (?:in use|active))/i,
  /\b(?:pay|transfer|send)\w*\b[^.]{0,40}\b(?:today|immediately|urgent(?:ly)?|asap|within \d+ hours?)/i,
  /\burgent(?:ly)?\b/i,
  /\bnaya account\b/i,
  /\baccount (?:badal|tabdeel)/i,
  /\baaj hi\b/i,
  /\bfauran\b/i,
];

export function findChangeOrUrgency(text: string): string | null {
  for (const re of CHANGE_OR_URGENCY) {
    const m = re.exec(text);
    if (m) {
      const start = Math.max(0, text.lastIndexOf(".", m.index) + 1);
      const end = text.indexOf(".", m.index + m[0].length);
      return text.slice(start, end === -1 ? undefined : end + 1).trim().slice(0, 160);
    }
  }
  return null;
}

const STOP = new Set(["the", "and", "of", "pvt", "ltd", "limited", "co", "company", "m", "s", "ms", "messrs", "traders", "trading", "enterprises", "industries", "industrial", "machines", "machinery", "sewing", "solutions", "tech", "corporation", "corp", "store", "shop"]);

function nameTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

// Account title matches the supplier when every distinctive word of one appears in the other
// ("Al-Noor Industrial Machines" vs "Al Noor Industrial Machines (Pvt) Ltd" match; vs "Noor Ahmed Traders" does not).
export function titleMatchesSupplier(title: string, supplierName: string): boolean {
  const a = nameTokens(title).join("");
  const b = nameTokens(supplierName).join("");
  if (!a || !b) return true; // nothing distinctive to compare
  return a === b || a.includes(b) || b.includes(a);
}

export function emailDomain(address: string | null | undefined): string | null {
  const m = address?.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/);
  return m ? m[1] : null;
}

// ---- assessment ----

type SupplierRef = { name: string; email?: string | null };

type AssessInput = {
  quotation: Quotation | null;
  emails: EmailRecord[];
  suppliers?: SupplierRef[];
  confirmations?: string[];
};

const RANK: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };

function worst(levels: RiskLevel[]): RiskLevel {
  return levels.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "low" as RiskLevel);
}

// Which supplier an email speaks for: a known supplier named in subject/body, else the sender's domain.
function supplierFor(email: EmailRecord, known: SupplierRef[]): SupplierRef | null {
  const norm = (s: string) => nameTokens(s).join(" ");
  const text = norm(`${email.subject} ${email.body}`);
  const byName = known.find((s) => norm(s.name) && text.includes(norm(s.name)));
  if (byName) return byName;
  const domain = emailDomain(email.toFrom);
  return known.find((s) => domain && emailDomain(s.email) === domain) ?? null;
}

export function assessPaymentRisks({ quotation, emails, suppliers = [], confirmations = [] }: AssessInput): PaymentRisk[] {
  const risks: PaymentRisk[] = [];
  const known: SupplierRef[] = [
    ...(quotation ? [{ name: quotation.supplierName, email: quotation.supplierEmail }] : []),
    ...suppliers.filter((s) => !quotation || s.name !== quotation.supplierName),
  ];

  // Account on file per supplier: the quotation's, then the first account seen in that supplier's emails.
  const onFile = new Map<string, string>();
  if (quotation?.iban) onFile.set(quotation.supplierName, normalizeIban(quotation.iban));

  // The quotation itself.
  if (quotation?.iban || quotation?.accountTitle) {
    const reasons: string[] = [];
    let level: RiskLevel = "low";
    if (quotation.iban && !isValidIban(quotation.iban)) {
      reasons.push("The IBAN on the quotation fails the IBAN checksum (a typo or a fake account).");
      level = "high";
    }
    if (quotation.accountTitle && !titleMatchesSupplier(quotation.accountTitle, quotation.supplierName)) {
      reasons.push(`The account title "${quotation.accountTitle}" does not match the supplier "${quotation.supplierName}".`);
      level = worst([level, "medium"]);
    }
    if (reasons.length) {
      risks.push({ id: "quotation", emailId: null, supplierName: quotation.supplierName, level, reasons, iban: quotation.iban ?? null, confirmed: confirmations.includes("quotation") });
    }
  }

  const incoming = emails.filter((e) => e.direction === "in").sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  for (const email of incoming) {
    const payment: PaymentDetails | null = email.payment ?? null;
    const iban = payment?.iban ?? findIbans(email.body)[0] ?? null;
    const urgencyQuote = payment?.urgencyQuote ?? findChangeOrUrgency(email.body);
    const hasUrgency = Boolean(payment?.urgency || urgencyQuote);
    if (!iban && !hasUrgency && !payment?.accountTitle) continue;

    const supplier = supplierFor(email, known);
    const supplierName = supplier?.name ?? (email.toFrom || "Unknown sender");
    const reasons: string[] = [];
    const levels: RiskLevel[] = [];

    if (iban) {
      if (!isValidIban(iban)) {
        reasons.push(`The IBAN ${formatIban(iban)} fails the IBAN checksum.`);
        levels.push("high");
      }
      const filed = supplier ? onFile.get(supplier.name) : undefined;
      if (filed && filed !== iban) {
        reasons.push(`Asks for payment to ${formatIban(iban)}, but the account on file for ${supplierName} is ${formatIban(filed)}.`);
        levels.push("high");
      }
      if (supplier && !filed) onFile.set(supplier.name, iban);
    }
    if (hasUrgency) {
      reasons.push(urgencyQuote ? `Account-change or urgency language: "${urgencyQuote}"` : "Account-change or urgency language.");
      levels.push("medium");
    }
    const title = payment?.accountTitle;
    if (title && supplier && !titleMatchesSupplier(title, supplier.name)) {
      reasons.push(`The account title "${title}" does not match the supplier "${supplier.name}".`);
      levels.push("medium");
    }
    const sender = emailDomain(email.toFrom);
    const knownDomain = emailDomain(supplier?.email);
    if (sender && knownDomain && sender !== knownDomain) {
      reasons.push(
        FREE_MAIL.includes(sender) && !FREE_MAIL.includes(knownDomain)
          ? `Sent from a free webmail address (${sender}) instead of the supplier's company domain (${knownDomain}).`
          : `Sent from ${sender}, not the supplier's known domain ${knownDomain}.`,
      );
      levels.push("medium");
    }
    if (!reasons.length) continue;
    risks.push({ id: email.id, emailId: email.id, supplierName, level: worst(levels), reasons, iban, confirmed: confirmations.includes(email.id) });
  }
  return risks;
}

// High risk that the owner has not yet cleared by phone blocks payment and the term-sheet request.
export function blockingRisks(risks: PaymentRisk[]): PaymentRisk[] {
  return risks.filter((r) => r.level === "high" && !r.confirmed);
}

// Reads bank details and warning language from an email body (code only; the AI may add a quote).
export function extractPaymentDetails(text: string): PaymentDetails | null {
  const iban = findIbans(text)[0] ?? null;
  const titleMatch = text.match(/(?:account\s*title|a\/c\s*title|title)\s*[:\-]\s*([^\n,;|]+?)(?:\s*[,;|\n]|\s+IBAN|$)/i);
  const bankMatch = text.match(
    /\b(Meezan Bank|Bank Alfalah|Habib Bank|HBL|United Bank|UBL|MCB Bank|MCB|Allied Bank|Askari Bank|Faysal Bank|Habib Metro(?:politan)?(?: Bank)?|Standard Chartered|JS Bank|Bank Al[- ]Habib|National Bank|NBP|Soneri Bank|Bank Islami|Dubai Islamic Bank)\b/i,
  );
  const urgencyQuote = findChangeOrUrgency(text);
  if (!iban && !titleMatch && !urgencyQuote) return null;
  return {
    iban,
    accountTitle: titleMatch ? titleMatch[1].trim() : null,
    bankName: bankMatch ? bankMatch[1] : null,
    urgency: Boolean(urgencyQuote),
    urgencyQuote,
  };
}
