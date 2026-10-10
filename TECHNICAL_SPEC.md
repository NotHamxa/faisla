# Faisla — Technical Specification

Team CodeStorm · AICON'26 Build With AI · Domain: **Financial Operations**
Presentation: 11 Oct 2026, 11:20–11:25, SEECS CR-01

> **Planning document**, written at the start of AICON'26 Build With AI (10 Oct 2026). Status labels (MUST, SHOULD,
> PROPOSED) are the plan, not the final build. The build uses MongoDB Atlas, Gmail SMTP/IMAP and OpenAI + Tavily, and
> includes Islamic-first financing and the payment-fraud check; [README.md](README.md) describes what was built.
> The finance numbers in §4 match the build and its unit tests.

Status legend used throughout:

- **MUST** — on the demo path; built first.
- **SHOULD** — built only after the full demo path works on the deployed link.
- **PROPOSED** — suggested addition, not yet agreed by the team or added to the build-plan doc.
- **ROADMAP** — shown on a slide only; not built.

---

## 1. Overview

Faisla ("decision") is a CFO-in-a-box for small and medium businesses. The owner uploads a supplier's
quotation; Faisla checks the price against the market, checks reviews of the supplier and the product,
finds and emails other suppliers, reads their replies, compares every way to pay (cash, the supplier's
deferred-price plan, and Shariah-compliant financing: Diminishing Musharakah, Ijarah, SBP Islamic LTFF), and writes a
one-page decision memo. **Islamic finance first:** conventional (interest-based) financing is compared only when the
owner's financing preference is "Islamic and conventional", is labelled, and is never recommended
(see docs/ISLAMIC_FINANCE.md).

**Core rule:** AI reads the messy documents and emails, code does every rupee of maths, and the owner
confirms. No number shown on screen is produced by an LLM.

### Fit to the module (Financial Operations)

| Module example | Faisla feature |
| --- | --- |
| Financial planning | Financing comparison: effective cost of paying later, PV, after-tax view, runway, stress test (core) |
| Credit and risk assessment | Islamic LTFF vs Diminishing Musharakah vs Ijarah, cash-risk check, supplier reputation; financing pack (PROPOSED) |
| Accounting automation | Quotation → structured data, arithmetic checks on totals |
| Payments | Payment-plan choice, installment reminders |
| Fraud detection | Payment-fraud check on supplier emails and bank details (PROPOSED) |

### Pitch flow required by organisers

| Stage | Faisla |
| --- | --- |
| Problem | SMEs make big purchase and borrowing decisions blind: the cost of paying later on "0%" plans, missed cheap Shariah-compliant financing, ignored tax, cash crunches |
| Data/Input | Quotation photo/PDF, supplier email replies, web prices and reviews, company cash and costs, SBP rates |
| AI Component | Vision extraction, search-result and review reading, RFQ and reply handling, memo writing |
| Solution | Ranked comparison of every way to pay + decision memo + bank term-sheet request |
| Impact | Demo: Rs 5.8 lakh saved (Rs 4.7 lakh after tax) and no cash crunch; SME finance gap |

---

## 2. Architecture

```
Browser (Next.js App Router, Tailwind, Recharts)
   │
   ├── /api/extract ─────────► LLM (vision, JSON mode)
   ├── /api/market ──────────► search cache ◄── search API (Tavily / Serper / Brave)
   ├── /api/reviews ─────────► search cache + LLM ──► code scoring
   ├── /api/suppliers ───────► search API + LLM
   ├── /api/rfq/send ────────► Gmail SMTP ──► team test inboxes
   ├── /api/rfq/replies ─────► Gmail IMAP (poll 10 s) ──► LLM extraction
   ├── /api/fraud-check ─────► code rules (+ LLM signals)            [PROPOSED]
   ├── /api/decide ──────────► lib/finance.ts (pure TypeScript, no AI)
   ├── /api/memo ────────────► LLM + code number-check
   ├── /api/loan-pack ───────► lib/finance.ts + template                [PROPOSED]
   └── /api/bank-email ──────► Gmail SMTP ──► test inbox "bank SME desk"
   │
MongoDB Atlas (users, sessions, companies, decisions)
```

| Layer | Choice | Notes |
| --- | --- | --- |
| Web app | Next.js (App Router, TypeScript) + Tailwind | Mobile-friendly; deploy to Vercel in hour 1 |
| Database | MongoDB Atlas | Free tier |
| Vision + text AI | One LLM API with vision and JSON output | Temperature 0–0.2, strict schemas |
| Web search | Tavily | Cache every demo query |
| Email send | Gmail SMTP (nodemailer) | Only to team test inboxes |
| Email read | Gmail IMAP on one test inbox (imapflow) | Poll every 10 s in demo |
| Charts | Recharts | Cost bars, runway line |
| Maths | `lib/finance.ts` + Vitest | No AI calls in this file, ever |

Secrets (LLM key, search key, Gmail app password, MongoDB URI) live in Vercel env vars only, never in the repo.

---

## 3. User flow

1. **Company profile** (one time): name, city, exporter flag, cash in bank, monthly fixed costs, tax rate, discount rate.
2. **Upload quotation**: photo/PDF → AI extraction → owner confirms/edits every field.
3. **Market and reputation check**: quoted price vs cached web prices and simulated benchmark → "% above market"; reviews of supplier and model → reputation flag with links.
4. **Find and email suppliers**: 2–3 suppliers found, RFQ emailed; replies read by AI, price extracted, offer row added; each new supplier gets the reputation check (and the fraud check, PROPOSED).
5. **Compare every way to pay**: cash, the supplier's deferred-price plan, Diminishing Musharakah, Ijarah, Islamic LTFF (if exporter); conventional loan / LTFF only under the "both" preference, never recommended. Before/after tax, runway, stress slider, Assumptions card with Shariah notes.
6. **Decide and act**: memo from the code's numbers; "Request term sheet" emails the bank; installment reminders (SHOULD); loan pack (PROPOSED).

---

## 4. Finance engine (`lib/finance.ts`)

Pure functions, fully unit-tested, written test-first by Person B. Reference implementation used to produce
every number in this spec: `reference/finance_reference.py`.

### 4.1 Conventions

- Month 0 = delivery date. Installments and rentals are paid in arrears (month 1, 2, …) unless the quotation says the first installment is due on delivery.
- Monthly discount rate from yearly: `d = (1 + yearly)^(1/12) − 1`.
- Monthly installments (Diminishing Musharakah, Murabaha, Islamic LTFF, conventional) and Ijarah rentals use the bank convention `i = yearlyRate / 12` on the outstanding amount; never compounded.
- Tax savings arrive at the end of each tax year (months 12, 24, …).
- Pre-tax flows are discounted at the pre-tax discount rate (15%); after-tax flows at the after-tax rate `15% × (1 − taxRate) = 10.65%`.
- All money is integer-safe PKR in storage; calculations in floating point, rounded only for display.

### 4.2 Functions

```ts
type Flow = { month: number; amount: number }; // positive = cash out

monthlyFromYearly(yearly: number): number;
yearlyFromMonthly(monthly: number): number; // (1 + r)^12 − 1

// 1. Effective monthly cost of the supplier's deferred-price plan vs its cash price (bisection, 0–20% a month)
hiddenMonthlyRate(cashPrice: number, installment: number, months: number,
                  firstDueOnDelivery: boolean): number;

// 2. Equal monthly installment / rental on the amount financed (bank convention i = rate ÷ 12)
emi(principal: number, yearlyRate: number, months: number): number;
amortisation(principal: number, yearlyRate: number, months: number):
  { month: number; payment: number; markup: number; principalPaid: number; balance: number }[];

// 3. Present value
presentValue(flows: Flow[], yearlyDiscountRate: number): number;

// 4. Tax
taxDepreciation(cost: number, opts: { initialAllowance: number; rate: number; lifeYears: number }): number[]; // per year
afterTaxFlows(flows: Flow[], markupByMonth: Map<number, number>, depreciableCost: number, taxRate: number): Flow[];

// 5. Liquidity
runwayMonths(cash: number, upfront: number, monthlyFixedCosts: number, newMonthlyPayment: number): number;

// Orchestration
buildOptions(company: Company, offers: Offer[], financing: FinancingOption[]): Option[];
compareOptions(options: Option[], company: Company): ComparisonRow[]; // before/after-tax PV, runway, verdict
breakEvenDiscountRate(option: Option, cashPrice: number): number;      // bisection on PV
stressTest(options: Option[], kiborShift: number): ComparisonRow[];    // shifts KIBOR-linked rates only
```

### 4.3 Formulas

1. **Effective cost of paying later** (supplier's deferred-price plan, a permissible bay' muajjal, not interest): find monthly `r` with `cashPrice = Σ installment / (1 + r)^t`, t = 1…n (or 0…n−1 if due on delivery). Yearly = `(1 + r)^12 − 1`. Also show the simple quote `r × 12`.
2. **Monthly installment / rental:** `P · i · (1 + i)^n / ((1 + i)^n − 1)`, `i = yearlyRate / 12`. P = bank's share (Diminishing Musharakah, Islamic LTFF), amount financed (Murabaha), or cost net of the security deposit (Ijarah).
3. **PV:** `Σ flow_t / (1 + d)^t`.
4. **After tax:** tax saved in year y = `(profit_y + depreciation_y) × taxRate`, received at month 12y. Depreciation base = what the option actually pays for the machines (installment total, cash price, or the financed purchase price). Ijarah: rentals are deducted as paid, no depreciation for the lessee during the lease; the security deposit is adjusted against the purchase price at the end (net nil), which is then depreciated at 15% reducing balance from the next tax year (no initial allowance). Schedule: 25% initial allowance in year 1, then 15% a year on the reducing balance (including year 1, on cost less the allowance), 10-year life, remainder written off in year 10. Scrap value ignored (same for every option).
5. **Runway:** `(cash − upfront) ÷ (monthlyFixedCosts + newMonthlyPayment)`. Counts no sales income, so it is a floor.
6. **Assumptions card:** lists the financing preference, processing fees, insurance (takaful) and collateral (editable fee field, default 0), Islamic LTFF approval time and eligibility (exporter, new machinery; confirmed by the bank), and Shariah notes (asset-backed, no compounding, late payment to charity, takaful, Shariah board approval).

### 4.4 Demo inputs (fictional)

| Input | Value |
| --- | --- |
| Company | Hamza Garments, Faisalabad, exporter |
| Cash in bank | Rs 1,00,00,000 |
| Monthly fixed costs | Rs 35,00,000 |
| Tax rate | 29% (editable) |
| Discount rate | 15% (≈ cost of financing, KIBOR + 3% ≈ 14.8% with an illustrative KIBOR of 11.8%, rounded); 10.65% after tax |
| Machine | Jack F5 direct-drive single-needle lockstitch (real model; new units listed in Pakistan at Rs 63,000–79,000, web median Rs 70,000) |
| Supplier A | 80 machines × Rs 75,000 = Rs 60,00,000; 12 × Rs 5,00,000 "0% markup", first installment one month after delivery; 8% cash discount → Rs 55,20,000 |
| Market benchmark | Median Rs 68,700 per machine (simulated, close to the real web median of Rs 70,000; A is ~9% above) |
| Supplier B | 80 × Rs 67,000 per machine = Rs 53,60,000 cash |
| Financing | 10% own share / security deposit (Rs 5,36,000), 36 months, P = Rs 48,24,000; Diminishing Musharakah and Ijarah 14.8% (illustrative KIBOR 11.8% + 3%; 6M KIBOR offer was 12.41% on 9 Oct 2026), SBP Islamic LTFF 8.5% (policy rate 11.5% − 3%, our arithmetic; set 28 Apr 2026, held 14 Sep 2026); conventional loan 14.8% and LTFF 8.5% kept for the "both" preference |

### 4.5 Expected results (the comparison table)

| Option | Pay | PV before tax | PV after tax | Runway | Verdict |
| --- | --- | --- | --- | --- | --- |
| A, deferred-price plan ("0%") | 12 × 5,00,000 | 55,67,038 | 44,87,290 | 2.50 | Paying later costs 16.9% a year |
| A, cash | 55,20,000 now | 55,20,000 | 44,20,541 | 1.28 | Salaries at risk |
| B, cash | 53,60,000 now | 53,60,000 | 42,92,409 | 1.33 | Cheapest price, drains cash |
| B, Diminishing Musharakah 14.8% | 5,36,000 + 36 × 1,66,753 | 54,11,012 | 43,32,522 | 2.58 | Safe, dearer than Islamic LTFF |
| B, Ijarah 14.8% | 5,36,000 + 36 × 1,66,753 | 54,11,012 | 41,90,272 | 2.58 | Safe, dearer than Islamic LTFF |
| **B, Islamic LTFF 8.5%** | 5,36,000 + 36 × 1,52,282 | **49,87,935** | **40,13,687** | **2.59** | **Recommended** |

Under the "Islamic and conventional" preference two more rows appear with the same numbers as their Islamic
counterparts, verdict "Interest-based, for comparison only": `B, conventional loan 14.8%` and `B, conventional LTFF 8.5%`.

- Savings vs "0%" plan: Rs 5,79,103 before tax, Rs 4,73,603 after tax.
- Runway today (no purchase): 2.86 months.
- Stress (KIBOR +2% → Diminishing Musharakah / Ijarah 16.8%): installment 1,71,509, PV 55,50,038 before tax; recommendation unchanged (Islamic LTFF is linked to the policy rate, not KIBOR; a Murabaha price is fixed at the contract).
- Islamic LTFF beats paying cash for any discount rate above 8.84% a year.

### 4.6 Unit tests (write first)

| Test | Expected |
| --- | --- |
| `hiddenMonthlyRate(55_20_000, 5_00_000, 12, false)` | 0.013067 ± 0.00001 (16.86% a year) |
| `hiddenMonthlyRate(55_20_000, 5_00_000, 12, true)` | 0.015537 ± 0.00001 (20.32% a year) |
| `emi(48_24_000, 0.148, 36)` | 1,66,753 ± 1 |
| `emi(48_24_000, 0.085, 36)` | 1,52,282 ± 1 |
| `emi(48_24_000, 0.168, 36)` | 1,71,509 ± 1 |
| PV before tax, Islamic LTFF row | 49,87,935 ± 5 |
| PV before tax, "0%" row | 55,67,038 ± 5 |
| PV before tax, Diminishing Musharakah row | 54,11,012 ± 5 |
| PV after tax, Islamic LTFF row | 40,13,687 ± 5 |
| PV after tax, "0%" row | 44,87,290 ± 5 |
| Runway, Islamic LTFF row | 2.59 ± 0.01 |
| Runway, "0%" row | 2.50 ± 0.01 |
| `taxDepreciation(53_60_000, …)` year 1, year 2, year 10 | 19,43,000 · 5,12,550 · 9,31,100 (± 1) |
| `breakEvenDiscountRate` Islamic LTFF vs B cash | 0.0884 ± 0.0005 |
| PV after tax, Ijarah row (rentals deductible, no lessee depreciation during the lease) | 41,90,272 ± 5 |
| Islamic preference | no conventional rows; recommendation always Shariah-compliant (also under "both") |

---

## 5. API routes

| Route | Input → output | Status |
| --- | --- | --- |
| `POST /api/extract` | image/PDF → quotation JSON draft (for confirm screen) | MUST |
| `POST /api/market` | model → cached search → cleaned prices + links + benchmark median | MUST |
| `POST /api/reviews` | supplier name + model → cached search → LLM review points → code score → reputation flag + links | SHOULD |
| `POST /api/suppliers` | item + city → 2–3 suppliers (name, email, phone, link) | MUST |
| `POST /api/rfq/send` | supplier + item → LLM-written RFQ → email sent, logged | MUST |
| `GET /api/rfq/replies` | reads test inbox → LLM extracts price/terms → offer row | MUST |
| `POST /api/fraud-check` | quotation/reply + supplier record → risk level + reasons | PROPOSED |
| `POST /api/decide` | company + offers + financing → comparison JSON (via `lib/finance.ts`) | MUST |
| `POST /api/memo` | decide JSON → memo (numbers inserted from JSON, then checked) | MUST |
| `POST /api/bank-email` | chosen option → term-sheet request email to "bank" test inbox | MUST |
| `POST /api/loan-pack` | decision → bank-ready PDF/HTML pack | PROPOSED |

All routes validate LLM output against a Zod schema; on failure they return `needsOwnerInput` instead of guessing.

---

## 6. Database (planned relational schema; built as MongoDB collections, see README)

| Table | Key columns | Status |
| --- | --- | --- |
| `companies` | id, name, city, is_exporter, cash_balance, monthly_fixed_costs, tax_rate, discount_rate | MUST |
| `quotations` | id, company_id, supplier_name, item, model, qty, unit_price, cash_discount_pct, installment_months, installment_amount, first_installment_on_delivery, file_url, confirmed | MUST |
| `offers` | id, company_id, supplier_name, unit_price, total, source (quote / email reply / web), source_link, received_at | MUST |
| `benchmarks` | item, model, city, unit_price, company_size, date (synthetic) | MUST |
| `financing_options` | name, type (bank / LTFF / installment), annual_rate, tenor_months, down_payment_pct, fee_pct, eligibility_rule, source_link | MUST |
| `emails` | id, direction (out / in), to_from, subject, body, offer_id, sent_at | MUST |
| `decisions` | id, company_id, comparison_json, recommended_option, memo_text, created_at | MUST |
| `reviews` | id, about (supplier / product), supplier_name, model, rating, complaint_type, quote, source_link, fetched_at | SHOULD |
| `supplier_accounts` | id, supplier_name, email_domain, bank_name, account_title, iban, first_seen_at, source | PROPOSED |
| `fraud_flags` | id, supplier_name, email_id, quotation_id, level (low / medium / high), reasons_json, created_at | PROPOSED |

---

## 7. AI components

All calls: temperature 0–0.2, strict JSON output validated by code; failures go to the owner, never to a guess.

### 7.1 Quotation extraction (vision) — MUST

Prompt: "Extract the quotation into this JSON. Use null for anything not printed. Never compute totals; copy numbers exactly as printed. Amounts in PKR as integers."

```json
{
  "supplier_name": "string",
  "supplier_phone": "string|null",
  "supplier_email": "string|null",
  "quote_date": "YYYY-MM-DD|null",
  "items": [{"description": "string", "model": "string|null", "qty": 0, "unit_price": 0}],
  "cash_discount_pct": "number|null",
  "installment_months": "number|null",
  "installment_amount": "number|null",
  "first_installment_on_delivery": "boolean|null",
  "markup_claimed_pct": "number|null",
  "validity_days": "number|null",
  "bank_name": "string|null",
  "account_title": "string|null",
  "iban": "string|null"
}
```

The last three fields are PROPOSED (for the fraud check). Code check: `qty × unit_price` must equal any printed line total; mismatches are flagged on the confirm screen.

### 7.2 Search-result cleaning — MUST

Prompt: "For each result, return seller, price in PKR, condition (new/used/unknown), exact model match (true/false), and the URL. Do not estimate missing prices."
Code: drop used items, non-matches, and outliers outside 0.5×–2× the median; require ≥ 3 prices, else show "not enough market data".

### 7.3 Review reading and reputation score — SHOULD

Prompt: "For each result, return: about (supplier or product), rating out of 5 or null, complaint type (delivery, warranty, quality, service, fraud or none), a one-line quote, and the URL. Do not invent ratings."

Code scoring:

- Drop duplicates and results not about this supplier/model.
- Fewer than 3 reviews → "not enough reviews" (no flag).
- Any `fraud` complaint, or average < 3, or ≥ 3 serious complaints (delivery / warranty / fraud) → **red flags**.
- Average ≥ 4 and ≤ 1 serious complaint → **good**.
- Otherwise → **mixed**.
- Red flags are listed as risks in the memo; they do not change the money figures.

### 7.4 RFQ email — MUST

Prompt: "Write a short, polite request for quotation from {company} in {city} for {qty} × {model}, asking for unit price, delivery time, warranty, and cash vs installment terms. Plain English, under 120 words."

### 7.5 Reply reading — MUST

Prompt: "From this supplier email, extract: unit_price (PKR integer or null), total (or null), delivery_days, warranty_months, payment_terms, and a one-line summary. If the price is unclear, set it to null and explain in summary." Must handle Roman Urdu ("67 hazar per unit" → 67000; "53.6 lakh" → 5360000). PROPOSED extra fields: bank_name, account_title, iban, urgency_or_account_change_language (boolean + quote).

### 7.6 Decision memo — MUST

Input: the decide JSON only. Prompt: "Write a one-page memo for the business owner: recommendation, why, the comparison, risks, next steps. Use ONLY the numbers in the JSON, written as given; do not calculate anything."

Number check (code): extract every number from the memo (strip commas, handle %), compare with the set of formatted values in the JSON. Any unknown number → regenerate (max 2 retries) → otherwise fall back to a fixed template memo filled from the JSON.

---

## 8. Payment-fraud check — PROPOSED at the start, built

The most common real-world payment fraud in SME purchasing is a "please pay to our new account" email
(business email compromise / invoice fraud). Faisla already reads quotations and replies, so it can flag this.

Rules (code, not AI):

| Signal | Level |
| --- | --- |
| IBAN in a reply differs from the IBAN on the quotation or on file | High |
| IBAN fails format/checksum (PK + 2 digits + 4-letter bank code + 16 digits, 24 chars; ISO 13616 mod-97) | High |
| AI flags account-change or urgency language ("account changed", "pay today", "advance to new account") | Medium |
| Account title does not fuzzy-match the supplier name | Medium |
| Sender email domain differs from the supplier's known domain, or switches from company domain to free webmail | Medium |
| Quotation arithmetic does not add up | Medium |
| No web presence found for the supplier | Low |

Output: `{ level, reasons[] }`. High → red banner, "Pay" and "Request term sheet" disabled until the owner
ticks "I confirmed the account by phone on a known number". Demo idea: a second fake reply asks for an
advance to a new account and is flagged live.

---

## 9. Loan pack — PROPOSED

Bank-ready summary from the decision, for the bank's SME desk: company profile, purchase and quotes
compared, chosen financing, 36-month repayment schedule (from `amortisation`), runway before/after, and
the Assumptions card. Optional input "monthly operating profit" enables a debt-service coverage ratio
(`monthly operating profit ÷ EMI`). Attached to the term-sheet email.

## 10. Investment check ("should you buy at all") — PROPOSED, lower priority

Optional input "expected extra monthly profit from the machines" → payback months
(`net cost ÷ extra monthly profit`) and NPV over the 10-year life at the discount rate.

---

## 11. Demo data (labelled "Demo data"; fictional except the machine's web prices and product reviews)

| Item | Contents |
| --- | --- |
| Company profile | Hamza Garments, Faisalabad, exporter, Rs 1 crore cash, Rs 35 lakh/month fixed costs, 29% tax |
| Supplier A quotation | Printed and photographed; letterhead, stamp; 80 × Jack F5 at Rs 75,000 (Rs 60 lakh), 8% cash discount, "12 months 0% markup", first installment one month after delivery (+ bank details, PROPOSED) |
| Benchmark table | 60 rows, Rs 65,200–74,700, median Rs 68,700, several cities ("simulated benchmark") |
| Cached web search | Real Jack F5 results with links (OLX, dealer video, Facebook, IndiaMART, Jack leaflet), pre-cleaned, saved as JSON; 3 new-unit PKR prices kept, median Rs 70,000 |
| Cached reviews | Simulated for the fictional suppliers: Supplier A (mixed: slow warranty service), Supplier B (good), Karachi Garment Tech (not enough). Real for the Jack F5 (Amazon.de, Reddit, Facebook, review site) |
| Supplier contacts | 2–3 fictional suppliers; emails are team test inboxes |
| Supplier B reply | "Bhai, 80 machines 67 hazar per unit final, delivery 10 din, 1 saal warranty", sent live from a phone |
| Fraud reply (PROPOSED) | "Our account has changed, please send advance to new account …" with a different IBAN |
| Financing options | Diminishing Musharakah and Ijarah KIBOR + 3% (≈ 14.8% with an illustrative KIBOR of 11.8%), SBP Islamic LTFF policy − 3% (8.5%), Murabaha preset; conventional loan and LTFF kept (shariahCompliant false); 10% own share / deposit, 36 months, source links |
| Bank contact | Test inbox named as the bank's SME desk |

---

## 12. Reliability, safety and fallbacks

- Every search used in the demo is cached; the demo never waits on the live web.
- Email polling every 10 s; if late, use the reply already in the inbox from rehearsal.
- Emails go only to team test inboxes; never to real companies.
- No real private data; synthetic data is labelled in the UI and the README.
- "Show calculation" on every comparison row (formula + inputs).
- Backup demo video saved locally; phone hotspot for Wi-Fi failure.

## 13. Assumptions and open items to verify before the demo

- Current KIBOR fixing (the demo uses an illustrative 11.8%; 6M KIBOR offer was 12.41% on 9 Oct 2026); exact Islamic LTFF profit rate a bank quotes today (SBP refinance is being phased out over FY24–28); policy rate 11.5% (set 28 Apr 2026, held 14 Sep 2026).
- 29% tax rate for the company type.
- 25% initial allowance and 15% depreciation for this machine class, and that both apply in year 1.
- 10-year machine life.
- LTFF eligibility conditions and typical approval time.
