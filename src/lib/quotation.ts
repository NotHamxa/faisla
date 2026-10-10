// Pure quotation helpers: arithmetic checks for the confirm screen and Quotation → Offer.
// No AI here. The model copies numbers as printed; this file is where they get checked.
import { formatPKR } from "./format";
import type { ArithmeticIssue, Offer, Quotation } from "./types";

// Rupee amounts are integers; allow rounding noise from decimals typed by the owner.
const TOLERANCE = 1;

function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > TOLERANCE;
}

export function lineAmount(item: { qty: number; unitPrice: number }): number {
  return item.qty * item.unitPrice;
}

// List price of the whole quotation (before cash discount), computed by code from the lines.
export function quotationListTotal(q: Quotation): number {
  return q.items.reduce((sum, item) => sum + lineAmount(item), 0);
}

// Cash price after the printed cash discount (list price when no discount is printed).
export function quotationCashPrice(q: Quotation): number {
  const pct = q.cashDiscountPct ?? 0;
  return quotationListTotal(q) * (1 - pct / 100);
}

// Field keys match the confirm screen: "items.0.lineTotal", "printedTotal", "installmentAmount", ...
export function checkArithmetic(q: Quotation): ArithmeticIssue[] {
  const issues: ArithmeticIssue[] = [];

  if (q.items.length === 0) {
    issues.push({ field: "items", message: "No items found. Add at least one line." });
  }

  q.items.forEach((item, i) => {
    if (!(item.qty > 0)) {
      issues.push({ field: `items.${i}.qty`, message: "Quantity must be more than zero." });
    }
    if (!(item.unitPrice > 0)) {
      issues.push({ field: `items.${i}.unitPrice`, message: "Unit price must be more than zero." });
    }
    if (item.lineTotal !== null && item.qty > 0 && item.unitPrice > 0) {
      const computed = lineAmount(item);
      if (differs(computed, item.lineTotal)) {
        issues.push({
          field: `items.${i}.lineTotal`,
          message: `${item.qty} × ${formatPKR(item.unitPrice)} = ${formatPKR(computed)}, but the quotation prints ${formatPKR(item.lineTotal)}.`,
        });
      }
    }
  });

  const listTotal = quotationListTotal(q);
  if (q.printedTotal !== null && q.items.length > 0 && differs(listTotal, q.printedTotal)) {
    issues.push({
      field: "printedTotal",
      message: `Lines add up to ${formatPKR(listTotal)}, but the printed total is ${formatPKR(q.printedTotal)}.`,
    });
  }

  if (q.cashDiscountPct !== null && (q.cashDiscountPct < 0 || q.cashDiscountPct > 50)) {
    issues.push({
      field: "cashDiscountPct",
      message: `A ${q.cashDiscountPct}% cash discount looks wrong. Expected between 0% and 50%.`,
    });
  }

  // Informational: a "0%" plan that costs more than paying cash is not 0%.
  if (q.installmentMonths && q.installmentAmount && listTotal > 0) {
    const installmentTotal = q.installmentMonths * q.installmentAmount;
    const cashPrice = quotationCashPrice(q);
    if (installmentTotal - cashPrice > TOLERANCE) {
      const claim =
        q.markupClaimedPct !== null
          ? ` Despite the "${q.markupClaimedPct}% markup" claim, paying later costs more than cash (a deferred-price sale).`
          : "";
      issues.push({
        field: "installmentAmount",
        message: `${q.installmentMonths} × ${formatPKR(q.installmentAmount)} = ${formatPKR(installmentTotal)}, which is ${formatPKR(installmentTotal - cashPrice)} more than the cash price of ${formatPKR(cashPrice)}.${claim}`,
      });
    }
  }

  return issues;
}

// One quotation = one offer. A single line keeps its qty × unit price; several lines are priced together as one
// purchase (qty 1, total of every line). Total is always computed here, never read.
export function quotationToOffer(q: Quotation, id = "offer-a"): Offer {
  const first = q.items[0] ?? { description: "", model: null, qty: 0, unitPrice: 0, lineTotal: null };
  // Several lines (machine + stand + installation…) are priced as one purchase: every line counts.
  const multi = q.items.length > 1;
  const total = multi ? q.items.reduce((sum, item) => sum + lineAmount(item), 0) : lineAmount(first);
  return {
    id,
    supplierName: q.supplierName,
    supplierEmail: q.supplierEmail,
    item: multi ? `${q.items.length} items: ${q.items.map((i) => i.description).join(", ")}` : first.description,
    model: first.model,
    qty: multi ? 1 : first.qty,
    unitPrice: multi ? total : first.unitPrice,
    total,
    cashDiscountPct: q.cashDiscountPct,
    installmentMonths: q.installmentMonths,
    installmentAmount: q.installmentAmount,
    firstInstallmentOnDelivery: q.firstInstallmentOnDelivery ?? false,
    source: "quote",
    sourceLink: null,
    receivedAt: new Date().toISOString(),
  };
}

// Blank quotation for the "type it in yourself" path (needsOwnerInput).
export function emptyQuotation(): Quotation {
  return {
    supplierName: "",
    supplierPhone: null,
    supplierEmail: null,
    quoteDate: null,
    items: [{ description: "", model: null, qty: 1, unitPrice: 0, lineTotal: null }],
    printedTotal: null,
    cashDiscountPct: null,
    installmentMonths: null,
    installmentAmount: null,
    firstInstallmentOnDelivery: null,
    markupClaimedPct: null,
    validityDays: null,
  };
}
