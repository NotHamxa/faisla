# Faisla (فیصلہ)

**A CFO in a box for SMEs.** Upload a supplier's quotation and Faisla compares every way to pay for it
(cash, supplier installments, bank loan, SBP LTFF), then writes a one-page decision memo. AI reads the
documents, code does every rupee of maths, and the owner confirms.

Team **CodeStorm** · AICON'26 Build With AI · Financial Operations

## Problem

Small and medium businesses make big purchase and borrowing decisions without a finance team. Four
mistakes keep happening:

1. **Hidden interest.** A "0% markup" installment plan usually costs more than the cash price. In the demo it hides 16.9% a year.
2. **Missed cheap loans.** Exporters buying new machinery qualify for SBP's LTFF (policy rate − 3%, so 8.5%), but most never ask for it.
3. **Ignored tax.** Markup and depreciation are tax-deductible, and that changes which option is cheaper.
4. **Cash crunch.** Paying cash for the cheapest price can leave barely a month of salaries in the bank.

## How it works

1. **Company profile.** Name, city, exporter flag, cash in bank, monthly fixed costs, tax rate, discount rate.
2. **Upload quotation.** AI vision reads the photo/PDF into fields; the owner confirms or edits every one, and code checks qty × price against the printed total.
3. **Market and reputation check.** The quoted price is compared with web prices and a benchmark ("% above market"). Supplier and product reviews get a code-scored flag (good / mixed / red flags).
4. **Find and email suppliers.** Faisla finds other suppliers and emails them a request for quotation (RFQ). AI reads their replies, Roman Urdu included ("13.4 lakh per unit"), and each price becomes a new offer.
5. **Compare every way to pay.** Cash, installments, bank loan and LTFF, each with its true cost in today's money (before and after tax), cash runway, a verdict, "show calculation", a KIBOR stress slider and an Assumptions card.
6. **Decide and act.** A decision memo built from the code's numbers (every number checked), a PDF export, and a "Request term sheet" email to the bank.

## Where the AI is (and isn't)

**AI reads, code calculates, owner confirms.**

| AI does | Code does |
| --- | --- |
| Reads the quotation photo/PDF (vision, strict JSON schema) | Checks quotation arithmetic |
| Cleans web search results into prices | Drops outliers, computes the benchmark median and "% above market" |
| Reads reviews into structured points | Scores reputation (good / mixed / red flags) |
| Writes RFQ emails, reads supplier replies | Builds offers from confirmed prices |
| Writes the memo's prose | Every rupee: hidden rate, EMI, present value, tax, runway, break-even (`src/lib/finance.ts`, unit-tested, no AI calls) |
| | **Memo number check:** extracts every number from the AI draft and compares it with the numbers code produced. Any unknown number → regenerate (max 2 retries) → fall back to a code template |

All AI calls go through `src/lib/ai.ts` and return `null` on failure. Every route then falls back to cached
data, a template, or asks the owner. It never guesses.

## Architecture

```
Browser (Next.js App Router, Tailwind, Recharts)
   │  state in localStorage (no database yet)
   │
   ├── /api/extract ─────────► Claude (vision, structured output) ──► quotation draft
   ├── /api/market ──────────► search cache ◄── Tavily ──► Claude cleaning ──► code median
   ├── /api/reviews ─────────► search cache + Claude ──► code scoring ──► reputation flag
   ├── /api/suppliers ───────► search + Claude ──► 2–3 suppliers
   ├── /api/rfq/send ────────► Claude-written RFQ ──► Gmail SMTP ──► team test inboxes
   ├── /api/rfq/replies ─────► Gmail IMAP ──► Claude extraction ──► offer row
   ├── /api/decide ──────────► lib/finance.ts (pure TypeScript, no AI)
   ├── /api/memo ────────────► facts from code ──► Claude ──► number check ──► memo (or template)
   └── /api/bank-email ──────► code template + repayment schedule ──► Gmail SMTP ──► "bank SME desk" test inbox
```

- Emails only ever go to team test inboxes (`ALLOWED_RECIPIENTS`; anything else is redirected to `TEST_INBOX`).
- Without email credentials, emails are logged as **simulated** so the demo path still works.
- Demo searches and reviews are served from `src/data/cache/`, so the demo never waits on the live web.

## Finance formulas

Code lives in `src/lib/finance.ts` (tests in `src/lib/finance.test.ts`). Month 0 is the delivery date.
Payments are in arrears unless the quotation says otherwise.

| Quantity | Formula |
| --- | --- |
| Hidden rate of an installment plan | Solve `cashPrice = Σ installment / (1 + r)^t`, t = 1…n (bisection); yearly = `(1 + r)^12 − 1` |
| Loan EMI | `P · i · (1 + i)^n / ((1 + i)^n − 1)`, `i = yearlyRate / 12` |
| Present value | `Σ flow_t / (1 + d)^t`, `d = (1 + yearly)^(1/12) − 1`; 15% before tax |
| After tax | Tax saved in year y = `(markup_y + depreciation_y) × taxRate`, received at month 12y, discounted at `15% × (1 − 29%) = 10.65%`. Depreciation: 25% initial allowance in year 1, then 15% reducing balance, 10-year life, on what each option actually pays |
| Runway | `(cash − upfront) / (monthlyFixedCosts + newMonthlyPayment)`. Counts no sales income, so it is a floor |
| Break-even discount rate | Discount rate at which the financed option's PV equals the cash price (bisection) |

### Demo results

Hamza Garments (fictional): Rs 1 crore cash, Rs 35 lakh/month fixed costs, 29% tax. Supplier A quotes
4 machines at Rs 15 lakh each, "12 × Rs 5,00,000 at 0% markup" or 8% off for cash. Supplier B replies
Rs 13.4 lakh each. Loans: 10% down, 36 months.

| Option | Pay | PV before tax | PV after tax | Runway (months) | Verdict |
| --- | --- | --- | --- | --- | --- |
| A, "0%" installments | 12 × 5,00,000 | 55,67,038 | 44,87,290 | 2.50 | Hidden 16.9% a year |
| A, cash | 55,20,000 now | 55,20,000 | 44,20,541 | 1.28 | Salaries at risk |
| B, cash | 53,60,000 now | 53,60,000 | 42,92,409 | 1.33 | Cheapest price, drains cash |
| B, bank 14.8% | 5,36,000 + 36 × 1,66,753 | 54,11,012 | 43,32,522 | 2.58 | Safe, dearer than LTFF |
| **B, LTFF 8.5%** | 5,36,000 + 36 × 1,52,282 | **49,87,935** | **40,13,687** | **2.59** | **Recommended** |

- Saves **Rs 5,79,103** before tax (**Rs 4,73,603** after tax) against the "0%" plan, and keeps 2.59 months of costs in the bank.
- LTFF beats paying cash at any discount rate above 8.84% a year.
- Stress test, KIBOR +2%: bank loan goes to 16.8% (EMI Rs 1,71,509). The recommendation doesn't change, because LTFF follows the policy rate, not KIBOR.

## Synthetic data disclosure

This is a hackathon demo. The following are **fictional or simulated** and are labelled "Demo data" in the app:

- The company (Hamza Garments) and its cash, costs and tax profile.
- Supplier A's quotation, supplier names and contacts. Supplier emails go to team test inboxes.
- The price benchmark table ("simulated benchmark") and the cached supplier/product reviews.
- The bank's SME desk, which is a team test inbox.

**Real inputs** when API keys are set: web search prices (Tavily) and the supplier's email reply (sent live
to the test inbox). SBP policy rate, KIBOR, the LTFF rate and the tax treatment are our best reading at the
time of the demo, and banks must confirm them. That is why the app emails the bank for a term sheet.

## Running locally

```bash
npm i
cp .env.example .env.local   # every key is optional
npm run dev                  # http://localhost:3000
npm test                     # Vitest: finance engine, number check, parsers
```

With no keys set, the app runs end to end on cached data, template memos and simulated emails.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API (extraction, cleaning, reviews, emails, memo) |
| `FAISLA_MODEL` | Model id, default `claude-opus-5-5` |
| `DEMO_MODE` | `1` = never call external APIs (cached data only) |
| `TAVILY_API_KEY` | Web search for market prices, reviews, suppliers |
| `GMAIL_USER` | Team test Gmail account (sends RFQs and the bank email, inbox polled for replies) |
| `GMAIL_APP_PASSWORD` | Gmail app password (SMTP + IMAP) |
| `TEST_INBOX` | Where emails to non-allowed addresses are redirected |
| `ALLOWED_RECIPIENTS` | Comma-separated team test inboxes allowed to receive mail |
| `BANK_INBOX` | Test inbox acting as the bank's SME desk (add it to `ALLOWED_RECIPIENTS` too) |
| `COMPANY_NAME` | Sender name on outgoing emails |

## Third-party APIs and libraries

- **Anthropic Claude API** (`claude-opus-5-5`, via `@anthropic-ai/sdk`): vision extraction, structured output, prose
- **Tavily**: web search
- **Gmail** SMTP/IMAP via `nodemailer`, `imapflow`, `mailparser`
- **Next.js 16** (App Router), **React 19**, **Tailwind CSS v4**
- **Recharts** (cost charts), **Zod** (schema validation of AI output), **Vitest** (tests)

## Team

**CodeStorm**, AICON'26 Build With AI, SEECS.
