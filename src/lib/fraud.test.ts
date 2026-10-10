import { describe, expect, it } from "vitest";
import { DEMO_FRAUD_REPLY, demoQuotation } from "./demoData";
import {
  assessPaymentRisks,
  blockingRisks,
  extractPaymentDetails,
  findChangeOrUrgency,
  isValidIban,
  titleMatchesSupplier,
} from "./fraud";
import type { EmailRecord } from "./types";

function inbound(over: Partial<EmailRecord>): EmailRecord {
  return {
    id: "email-in-1",
    direction: "in",
    toFrom: "sales@alnoor-machines.pk",
    subject: "Re: Quotation",
    body: "",
    offerId: null,
    sentAt: "2026-10-11T06:30:00.000Z",
    simulated: false,
    ...over,
  };
}

describe("IBAN validation", () => {
  it("accepts valid Pakistani IBANs with or without spaces", () => {
    expect(isValidIban("PK76 MEZN 0002 3101 0456 7890")).toBe(true);
    expect(isValidIban("PK59ALFH0047120098761234")).toBe(true);
  });
  it("rejects bad checksums and wrong shapes", () => {
    expect(isValidIban("PK36 MEZN 0002 3101 0456 7890")).toBe(false);
    expect(isValidIban("PK76 MEZN 0002 3101 0456")).toBe(false);
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(false);
  });
});

describe("names and language", () => {
  it("matches account titles to the supplier loosely but not to a different business", () => {
    expect(titleMatchesSupplier("Al Noor Industrial Machines (Pvt) Ltd", "Al-Noor Industrial Machines")).toBe(true);
    expect(titleMatchesSupplier("Al Noor Traders", "Al-Noor Industrial Machines")).toBe(true);
    expect(titleMatchesSupplier("Noor Ahmed Enterprises", "Al-Noor Industrial Machines")).toBe(false);
  });
  it("spots account-change and urgency wording, English and Roman Urdu", () => {
    expect(findChangeOrUrgency("Due to audit our bank account has changed.")).toContain("account has changed");
    expect(findChangeOrUrgency("Please send the advance today to the new account.")).not.toBeNull();
    expect(findChangeOrUrgency("Bhai naya account hai, aaj hi bhej dein")).not.toBeNull();
    expect(findChangeOrUrgency("4 machines 13.4 lakh per unit final, delivery 10 din")).toBeNull();
  });
  it("reads bank details from an email body", () => {
    const p = extractPaymentDetails(DEMO_FRAUD_REPLY.body)!;
    expect(p.iban).toBe("PK59ALFH0047120098761234");
    expect(p.bankName).toMatch(/Alfalah/i);
    expect(p.accountTitle).toBe("Imran Qureshi");
    expect(p.urgency).toBe(true);
  });
});

describe("assessPaymentRisks", () => {
  it("passes the genuine quotation (valid IBAN, matching title)", () => {
    expect(assessPaymentRisks({ quotation: demoQuotation, emails: [] })).toEqual([]);
  });

  it("flags the demo 'new account' email as high risk with every reason", () => {
    const email = inbound({ toFrom: DEMO_FRAUD_REPLY.from, subject: DEMO_FRAUD_REPLY.subject, body: DEMO_FRAUD_REPLY.body });
    const email2 = { ...email, payment: extractPaymentDetails(email.body) };
    const [risk] = assessPaymentRisks({ quotation: demoQuotation, emails: [email2] });
    expect(risk.level).toBe("high");
    expect(risk.supplierName).toBe(demoQuotation.supplierName);
    const text = risk.reasons.join(" ");
    expect(text).toMatch(/account on file/);
    expect(text).toMatch(/urgency/i);
    expect(text).toMatch(/free webmail/);
    expect(text).toMatch(/does not match the supplier/);
    expect(blockingRisks([risk])).toHaveLength(1);
  });

  it("is cleared once the owner confirms by phone", () => {
    const email = inbound({ toFrom: DEMO_FRAUD_REPLY.from, subject: DEMO_FRAUD_REPLY.subject, body: DEMO_FRAUD_REPLY.body });
    const risks = assessPaymentRisks({ quotation: demoQuotation, emails: [email], confirmations: [email.id] });
    expect(risks[0].confirmed).toBe(true);
    expect(blockingRisks(risks)).toHaveLength(0);
  });

  it("ignores an ordinary priced reply", () => {
    const email = inbound({ toFrom: "supplier-b@example.com", body: "Bhai, 4 machines 13.4 lakh per unit final, delivery 10 din, 1 saal warranty" });
    expect(assessPaymentRisks({ quotation: demoQuotation, emails: [email] })).toEqual([]);
  });

  it("flags a quotation whose IBAN fails the checksum", () => {
    const risks = assessPaymentRisks({ quotation: { ...demoQuotation, iban: "PK36 MEZN 0002 3101 0456 7890" }, emails: [] });
    expect(risks[0]).toMatchObject({ id: "quotation", level: "high" });
  });

  it("flags a different-but-valid IBAN even with polite wording and the right domain", () => {
    const email = inbound({ body: "Please use our account: Title: Al-Noor Industrial Machines, IBAN PK59 ALFH 0047 1200 9876 1234." });
    const [risk] = assessPaymentRisks({ quotation: demoQuotation, emails: [email] });
    expect(risk.level).toBe("high");
    expect(risk.reasons).toHaveLength(1);
  });
});

describe("memo payment risks", () => {
  const ctx = { paymentRisks: [{ supplierName: "Al-Noor Industrial Machines", level: "high" as const, confirmed: false }] };
  it("adds the warning under Risks when the AI left it out", async () => {
    const { ensurePaymentRisks } = await import("./memoTemplate");
    const out = ensurePaymentRisks("# Memo\n\n## Risks\n- Cash runway is thin.\n\n## Next steps\n1. Call the bank.", ctx);
    expect(out).toMatch(/## Risks\n- \*\*Payment-fraud warning \(Al-Noor/);
    expect(out).toContain("## Next steps");
  });
  it("leaves a memo alone when it already mentions the fraud risk", async () => {
    const { ensurePaymentRisks } = await import("./memoTemplate");
    const memo = "## Risks\n- Possible payment fraud: confirm Al-Noor's account by phone.";
    expect(ensurePaymentRisks(memo, ctx)).toBe(memo);
  });
});
