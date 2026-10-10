# Faisla (فیصلہ)

**A CFO in a box for SME purchase decisions, Islamic finance first.** Faisla compares every way to pay for a big
purchase (cash, the supplier's deferred-price plan, Diminishing Musharakah, Ijarah, SBP Islamic LTFF) and writes a
one-page decision memo. AI reads the messy documents and emails, code does every rupee of maths, and the owner
confirms.

| | |
| --- | --- |
| Live app | https://faisla-xi.vercel.app |
| Demo login | `demo@faisla.pk` / `faisla2026` (first sign-in seeds 3 sample decisions) |
| Repository | https://github.com/NotHamxa/faisla |
| Team | CodeStorm · AICON'26 Build With AI · Financial Operations |

## Problem

SME owners make big purchase and borrowing decisions without a finance team. Four mistakes keep happening:

1. **The cost of paying later.** A "0% markup" plan is a deferred-price sale: permissible, but the price is higher than cash. In the demo, paying later costs 16.9% a year.
2. **Missed cheap Shariah-compliant financing.** Exporters buying new machinery qualify for SBP's Islamic LTFF (policy rate − 3% = 8.5%), but most never ask.
3. **Ignored tax.** Profit, Ijarah rentals and depreciation are tax-deductible, and that changes which option is cheaper.
4. **Cash crunch.** Paying cash for the cheapest price can leave barely a month of salaries in the bank.

## Islamic finance first

Pakistan's 26th Constitutional Amendment (2024) commits the state to eliminating riba before 1 January 2028, and the
Federal Shariat Court set 31 December 2027. Faisla is built for that:

- **Shariah-compliant by default.** Comparisons include Diminishing Musharakah (co-ownership: rent on the bank's
  share + monthly purchase of its units), Ijarah (lease: security deposit, rentals, ownership transferred at the
  end), Murabaha (cost-plus sale at a fixed deferred price, as a preset) and SBP Islamic LTFF, priced off KIBOR or
  the SBP policy rate.
- **Conventional only on request.** The financing preference ("Shariah-compliant only" or "Islamic and
  conventional") lives on the Financing page and in Settings. Conventional (interest-based) rows are labelled and
  never recommended.
- **Correct tax per mode.** Ijarah rentals are deducted as paid, with no depreciation for the lessee during the
  lease. Diminishing Musharakah and Murabaha deduct profit, and the owner depreciates the machines (25% initial
  allowance + 15% reducing balance).
- **Honest words.** No "interest", "loan" or "EMI" for Islamic products: profit rate, rental, installment,
  financing. The supplier's plan is a deferred-price sale with an effective annual cost, not "hidden interest".
- **Shariah notes on every comparison.** Asset-backed, no compounding, late payment to charity, takaful, and the
  bank's Shariah board approval confirmed on the term sheet. The term-sheet email goes to an Islamic bank's SME desk
  and asks exactly those questions.

Sources and modelling details: [docs/ISLAMIC_FINANCE.md](docs/ISLAMIC_FINANCE.md).

## How it works

Each purchase is a **decision** with five steps (tabs). There are two ways to start one:

- **Upload a supplier quotation** (photo or PDF). AI vision copies the printed fields; the owner confirms or edits each one, and code checks qty × unit price against the printed totals.
- **Describe what you need** ("2 industrial embroidery machines in Lahore, budget 20 lakh"). AI turns the need into search queries and reads the listings; code drops listings whose price isn't written in the page, used items, non-matches, duplicates and outliers, then ranks the rest. The owner ticks 1–3 to become offers.

| Step | What happens |
| --- | --- |
| 1. Quotation / Your need | One of the two starts above |
| 2. Price & reputation | Quoted price vs web prices and a benchmark ("% above market"); supplier and product reviews scored by code as good / mixed / red flags |
| 3. Competing offers | Faisla finds other suppliers and emails them an RFQ. The inbox is polled every 10 s; AI reads replies, Roman Urdu included ("67 hazar per unit"), and each confirmed price becomes an offer. "Paste a reply" is the fallback |
| 4. Compare | Every way to pay: cash, the supplier's deferred-price plan, Diminishing Musharakah, Ijarah, Islamic LTFF (conventional rows only if the preference includes them). PV before and after tax, cash runway, verdict, "Show calculation" per row, KIBOR stress slider, break-even discount rate, Assumptions card with Shariah notes |
| 5. Decide | Decision memo built from the code's numbers (every number checked, Islamic finance terms), PDF export, and a "Request term sheet" email to an Islamic bank's SME desk (profit rate, takaful, security deposit, late-payment charity undertaking, Shariah board approval) with a 36-month installment schedule attached |

Around the decisions sits a management shell:

- **Dashboard:** cash, runway today and after committed purchases, savings found, upcoming installments and rentals, a 12-month cash chart, and alerts (runway drop, the cost of paying later on a "0%" plan, red-flag reviews, expiring quotations, term sheet to request).
- **Suppliers:** every supplier seen across decisions, merged by name, with reputation.
- **Financing:** the Islamic-first preference, a short explainer of each Islamic mode, KIBOR and policy-rate references, and the company's financing options (Islamic presets plus conventional), editable; used in every comparison.
- **Inbox:** every RFQ, reply and bank email across decisions.
- **Settings:** company profile, account, light/dark/system theme, and what is real vs simulated.

## Where the AI is, and isn't

**AI reads, code calculates, owner confirms.** No number shown on screen is computed by an LLM. All AI calls
go through `src/lib/ai.ts` (OpenAI Responses API, strict Zod-validated structured output) and return `null`
on failure; the route then falls back to cached data, a template, or asks the owner. It never guesses.

| AI task | Model tier | What code checks afterwards |
| --- | --- | --- |
| Read the quotation photo/PDF into fields | vision | qty × unit price vs printed line totals and grand total; owner confirms every field |
| Turn a described need into a search request | fast | Budget and quantity only kept if the owner actually wrote that amount |
| Read marketplace listings for a need | read | Each price must be an amount written in that listing's text; used, non-matching, duplicate and 0.5×–2× median outliers dropped; median needs ≥ 3 prices |
| Clean web price results for the market check | fast | Used and non-exact-model items and outliers dropped; ≥ 3 prices or "not enough market data"; median and "% above market" computed in code |
| Read reviews into structured points | fast | Reputation flag from fixed code rules (`src/lib/reputation.ts`); red flags become memo risks and never change money figures |
| Find dealers on the web | fast | Only names/phones printed in results; contact email forced to a team test inbox |
| Write the RFQ email | write | Template if AI is unavailable; recipient restricted to test inboxes |
| Read supplier replies (Roman Urdu, lakh) | fast | Price cross-checked by a deterministic Roman Urdu/lakh parser against amounts written in the email; parser alone if AI is down; unclear price → owner |
| Write the decision memo prose | write | Every number in the draft must match the code's facts list; unknown number → regenerate (max 2 retries) → code template |

Code does everything else: the effective cost of paying later, monthly installments and rentals, PV, tax, runway, break-even, stress test, ranking and verdicts
(`src/lib/finance.ts`, pure TypeScript, unit-tested, no AI and no I/O). The bank term-sheet email is a code
template; no AI touches it.

## Payment-fraud check

The most common real payment fraud in SME purchasing is the "please pay to our new account" email. Faisla
already reads quotations and replies, so it checks the bank details in them with code rules:

| Signal | Level |
| --- | --- |
| IBAN in a reply differs from the IBAN on the quotation or on file | High |
| IBAN fails the format/checksum test (PK, 24 characters, ISO 13616 mod-97) | High |
| Account-change or urgency language ("account changed", "pay today", "advance to new account") | Medium |
| Account title does not match the supplier name | Medium |
| Sender domain differs from the supplier's known domain, or switches from a company domain to free webmail | Medium |

The output is a risk level with reasons (`src/lib/fraud.ts`, unit-tested). Wording is caught by code patterns
(English and Roman Urdu); the AI only adds a quoted sentence the patterns miss, and the level always comes from
the rules. The warning shows at the top of the decision, on the email, in the memo's Risks and as a dashboard
alert. **High risk blocks the "Request term sheet" action** until the owner ticks that they confirmed the account
by phone on a number they already had. Demo: confirm the demo quotation (its IBAN is kept on file), then use
"Demo fraud email" under *Paste a reply* on the Competing offers step.

## Architecture

```
Browser (React 19 client components, autosaving store)
   │
   ▼
Next.js 16 App Router (Vercel) ── src/proxy.ts session gate
   ├── server pages ─────────────────────────────┐
   └── route handlers /api/* ──┬── OpenAI Responses API   (src/lib/ai.ts)
                               ├── Tavily web search      (cache first: src/data/cache)
                               ├── Gmail SMTP / IMAP      (nodemailer, imapflow + mailparser)
                               └── src/lib/finance.ts     (pure maths, no AI, no I/O)
                                          │
                                          ▼
                               MongoDB Atlas (users, sessions, companies, decisions)
```

**Pages**

| Route | Purpose |
| --- | --- |
| `/login`, `/signup` | Email + password auth; demo login seeds sample data |
| `/dashboard` | Cash, runway, savings, upcoming payments, alerts |
| `/decisions` | All decisions, newest first; new decision dialog |
| `/decisions/[id]` | The five-step workspace (`?step=` keeps your place on refresh) |
| `/suppliers` | Supplier directory with reputation |
| `/financing` | Islamic-first preference, Islamic modes explained, SBP reference rates, editable financing options |
| `/inbox` | All sent and received emails |
| `/settings` | Profile, account, theme, real vs simulated data |
| `/demo/quotation` | Printable fictional Supplier A quotation, photographed for the live demo (public) |

**API routes**

| Route | Purpose |
| --- | --- |
| `POST /api/extract` | Quotation photo/PDF → draft fields + arithmetic issues |
| `POST /api/sourcing` | Described need → ranked web listings + median |
| `POST /api/market` | Model + quoted price → web prices, benchmark, % above market |
| `POST /api/reviews` | Supplier or model → reviews + code-scored reputation flag |
| `POST /api/suppliers` | Other suppliers to ask (demo list, optional live dealers) |
| `POST /api/rfq/send` | AI-written RFQ → Gmail SMTP → test inbox |
| `GET/POST /api/rfq/replies` | Poll the Gmail inbox (IMAP), or read a pasted reply → offer |
| `POST /api/decide` | Company + offers + financing → comparison (finance.ts only) |
| `POST /api/memo` | Comparison → AI memo with number check, or template |
| `POST /api/bank-email` | Chosen financing row → term-sheet request (Islamic bank SME desk for Islamic rows) + installment schedule |
| `GET/PATCH /api/company` | Company profile and financing options |
| `GET/POST /api/decisions`, `GET/PATCH/DELETE /api/decisions/[id]` | Decision CRUD (autosave target) |

**Data model (MongoDB).** Every query is scoped by `companyId`.

| Collection | Contents |
| --- | --- |
| `users` | email (unique), name, scrypt password hash, companyId |
| `sessions` | SHA-256 of the session token, userId, expiry (TTL index) |
| `companies` | Profile (city, exporter flag, cash, fixed costs, tax and discount rate) + financing options |
| `decisions` | Title, origin (quotation or need), status, and embedded quotation, sourcing results, offers, market check, reputations, suppliers, emails, comparison and memo |

**Autosave.** The client store debounces changes (600 ms) and PATCHes the company and the decision
separately. The server derives the status (draft → collecting → comparing → decided) from what is filled in.

**Auth.** Passwords hashed with Node's scrypt (random salt, constant-time compare). Sessions are a random
32-byte token in an httpOnly cookie; only its SHA-256 hash is stored, with a 7-day expiry. `src/proxy.ts`
sends signed-out visitors to `/login` (401 for API calls); pages and the company/decision routes verify the
session against the database.

**Email safety.** Mail only goes to addresses in `ALLOWED_RECIPIENTS`; anything else is redirected to
`TEST_INBOX`. Without Gmail credentials, emails are recorded as **simulated** so the demo path still works.

## Finance formulas

Code: `src/lib/finance.ts`, tests: `src/lib/finance.test.ts`. Month 0 is the delivery date; payments are in
arrears unless the quotation says the first installment is due on delivery.

| Quantity | Formula |
| --- | --- |
| Effective cost of a deferred-price plan | Solve `cashPrice = Σ installment / (1 + r)^t`, t = 1…n (0…n−1 if due on delivery), by bisection; yearly = `(1 + r)^12 − 1` |
| Monthly installment / rental | `P · i · (1 + i)^n / ((1 + i)^n − 1)`, `i = yearlyRate / 12` on the bank's share (Diminishing Musharakah), amount financed (Murabaha) or cost net of the security deposit (Ijarah) |
| Present value | `Σ flow_t / (1 + d)^t`, `d = (1 + yearly)^(1/12) − 1`; 15% discount rate before tax |
| After tax | Tax saved in year y = `(profit_y or rentals_y + depreciation_y) × taxRate`, received at month 12y, discounted at `15% × (1 − 29%) = 10.65%`. Depreciation on what each option actually pays: 25% initial allowance in year 1, then 15% a year on the reducing balance, 10-year life. Ijarah: rentals deducted as paid, no depreciation during the lease, then 15% reducing balance on the purchase price |
| Runway | `(cash − upfront) / (monthlyFixedCosts + newMonthlyPayment)`. Counts no sales income, so it is a floor |
| Break-even discount rate | Discount rate at which the financed option's PV equals the cash price (bisection) |

### Demo results

Hamza Garments (fictional, Faisalabad exporter): Rs 1 crore cash, Rs 35 lakh/month fixed costs, 29% tax.
The machine is real: 80 × Jack F5 direct-drive lockstitch machines (new units are listed in Pakistan at
Rs 63,000–79,000, median Rs 70,000). Supplier A quotes 80 × Rs 75,000 = Rs 60 lakh, "12 × Rs 5,00,000 at 0% markup"
or 8% off for cash (~9% above the market benchmark). Supplier B replies Rs 67,000 each (Rs 53.6 lakh).
Financing (Shariah-compliant only): 10% own share or security deposit, 36 months; Diminishing Musharakah and Ijarah
at 14.8% (KIBOR + 3%), SBP Islamic LTFF 8.5% (policy 11.5% − 3%).

| Option | Pay | PV before tax | PV after tax | Runway (months) | Verdict |
| --- | --- | --- | --- | --- | --- |
| A, deferred-price plan ("0%") | 12 × 5,00,000 | 55,67,038 | 44,87,290 | 2.50 | Paying later costs 16.9% a year |
| A, cash | 55,20,000 now | 55,20,000 | 44,20,541 | 1.28 | Salaries at risk |
| B, cash | 53,60,000 now | 53,60,000 | 42,92,409 | 1.33 | Cheapest price, drains cash |
| B, Diminishing Musharakah 14.8% | 5,36,000 + 36 × 1,66,753 | 54,11,012 | 43,32,522 | 2.58 | Safe, dearer than Islamic LTFF |
| B, Ijarah 14.8% | 5,36,000 + 36 × 1,66,753 | 54,11,012 | 41,90,272 | 2.58 | Safe, dearer than Islamic LTFF |
| **B, Islamic LTFF 8.5%** | 5,36,000 + 36 × 1,52,282 | **49,87,935** | **40,13,687** | **2.59** | **Recommended** |

- **Saves Rs 5,79,103 before tax (Rs 4,73,603 after tax)** against the "0%" plan, and keeps 2.59 months of costs in the bank (2.86 today with no purchase).
- Islamic LTFF beats paying cash at any discount rate above 8.84% a year.
- Ijarah beats Diminishing Musharakah after tax at the same 14.8%, because rentals are deducted within 3 years.
- Stress test, KIBOR +2%: Diminishing Musharakah and Ijarah reprice to 16.8% (installment Rs 1,71,509, PV Rs 55,50,038 before tax). The recommendation doesn't change, because Islamic LTFF follows the policy rate, not KIBOR.
- With "Islamic and conventional" selected, a conventional loan (14.8%) and conventional LTFF (8.5%) appear with the same numbers, labelled "Interest-based, for comparison only"; the recommendation stays Islamic LTFF.

Every figure above is asserted in the unit tests.

## Cost and model choice

Each AI call picks a tier, so cheap models do the easy work. Defaults were chosen by `scripts/models.live.ts`,
which runs candidate models through the real routes on the real tasks (quotation photo, Roman Urdu replies,
memo number check) and picks the most accurate, then the cheapest:

| Tier | Default | Used for |
| --- | --- | --- |
| vision | `gpt-6-luna` | Quotation photos (12/12 fields) |
| fast | `gpt-4.1-nano` | Replies, need structuring, search results, reviews, dealers |
| read | `gpt-6-luna` | Messy multi-listing marketplace pages |
| write | `gpt-6-luna` | RFQ email, memo (passes the number check first time) |

A full demo run costs about **$0.002** in API usage. Each tier can be overridden with an env var. Rerun the
benchmark with `npx vitest run -c vitest.live.config.ts scripts/models.live.ts` (spends a little API credit;
results go to `scripts/bench-results.txt`).

## Synthetic data disclosure

This is a hackathon demo. The following are **fictional or simulated** and labelled in the UI:

- The company (Hamza Garments), its cash, costs and tax profile, and the seeded sample decisions.
- Supplier A's quotation (Al-Noor Industrial Machines) and the supplier contacts (Madina Sewing Solutions, Karachi Garment Tech).
- The 60-row price benchmark table ("simulated benchmark", median Rs 68,700, set close to the real web median).
- The cached supplier reviews (Al-Noor, Madina, Karachi Garment Tech); their links open real search pages, not the source of the quote.
- The bank's SME desk, which is a team test inbox.

**Real data:** the demo machine (Jack F5) and its cached web prices are real listings with links, collected
10 Oct 2026: two new units on OLX (Rs 79,000 and Rs 70,000, Lahore) and a Lahore dealer video (Rs 63,000); the
cleaning rules drop a used Jack F6, a Jack F4 and two results without a PKR price, leaving a median of Rs 70,000.
The cached Jack F5 product reviews are real (Amazon.de, Reddit, Facebook, a review site), each with its link.
With API keys set, a described need for anything else searches the live web and returns real listings, and
supplier replies arrive as real emails. All outgoing emails go only to team test inboxes, never
to real companies. SBP policy rate (11.5%), KIBOR, the Islamic LTFF rate and the tax treatment are our best reading at
the time of the demo; banks must confirm them, which is why the app emails the bank for a term sheet.

## Running locally

```bash
npm i
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm test           # 113 Vitest tests: finance engine, memo number check, reply parser, sourcing, reputation, quotation, dashboard
npx vitest run -c vitest.live.config.ts   # live checks (model benchmark + one live sourcing search); spends API credit
```

Login needs MongoDB (a local `mongod`, or an Atlas URI in `MONGODB_URI`). Every other key is optional: with
none set, the app runs end to end on cached data, template memos and simulated emails.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string (default `mongodb://127.0.0.1:27017`; Atlas in production). Required for login |
| `MONGODB_DB` | Database name (default `faisla`) |
| `OPENAI_API_KEY` | OpenAI API for all AI tasks |
| `OPENAI_MODEL_VISION` / `_FAST` / `_READ` / `_WRITE` | Optional per-tier model overrides |
| `DEMO_MODE` | `1` = never call external APIs (cached data only) |
| `TAVILY_API_KEY` | Web search for prices, reviews, listings and dealers |
| `GMAIL_USER` | Team test Gmail account (sends RFQs and the bank email; inbox polled for replies) |
| `GMAIL_APP_PASSWORD` | Gmail app password (SMTP + IMAP) |
| `TEST_INBOX` | Where mail to non-allowed addresses is redirected |
| `ALLOWED_RECIPIENTS` | Comma-separated team test inboxes allowed to receive mail |
| `BANK_INBOX` | Test inbox acting as the bank's SME desk (add it to `ALLOWED_RECIPIENTS` too) |
| `COMPANY_NAME` | Sender name on outgoing emails |

## Third-party APIs and libraries

| Name | Used for |
| --- | --- |
| OpenAI API (`openai` SDK, Responses API) | Vision extraction, structured output, emails and memo prose |
| Tavily | Web search |
| Gmail via `nodemailer`, `imapflow`, `mailparser` | Sending RFQs and bank email (SMTP), reading replies (IMAP) |
| MongoDB Node.js driver, MongoDB Atlas | Users, sessions, companies, decisions |
| Next.js 16 (App Router), React 19 | App framework |
| Tailwind CSS v4, shadcn/ui (Base UI), lucide-react, sonner | UI components, icons, toasts |
| Recharts | Cost and cash charts |
| Zod | Validation of AI output and API input |
| next-themes | Light/dark/system theme |
| Vitest | Unit tests and the live model benchmark |

---

**Team CodeStorm** · AICON'26 Build With AI
