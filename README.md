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

## How to test (about 2 minutes)

Open https://faisla-xi.vercel.app and press **Sign in as demo** (or type `demo@faisla.pk` / `faisla2026`). The demo
company is fictional; the first sign-in seeds 3 sample decisions. Nothing you do emails a real company: all mail goes to
team test inboxes.

Demo helpers (demo quotation, demo reply, demo fraud email) sit in a small **Demo** menu at the top right of each step.

1. **Dashboard:** cash, cash left (months), money saved, open decisions, then alerts and recent decisions.
2. **New decision** (top bar) → **I have a quotation** → **Create decision**. On step **1 Quote**, open **Demo → Use demo
   quotation**, then **Confirm quotation** (80 × Jack F5 at Rs 75,000, "12 × Rs 5,00,000 at 0% markup" or 8% off for
   cash). Dates, totals and the bank account are under **More details**.
3. **2 Price check:** "This price is about 9% above the market"; **See prices** opens the benchmark and the real web
   listings. Supplier reviews are scored by code.
4. **3 Other offers:** **Ask suppliers for prices** (finds two suppliers and emails both a price request). Then
   **Demo → Use demo reply → Read reply** (Roman Urdu: "67 hazar per unit") adds "New offer: Rs 67,000 each". Then
   **Demo → Demo fraud email**: a "new bank account" email raises a high-risk payment-fraud warning (IBAN changed,
   urgency wording, title mismatch). **Add an offer from a link** reads one web listing.
5. **4 Compare:** the answer card says **Best way to pay: Islamic LTFF 8.5% with Madina Sewing Solutions**, saves
   Rs 4,73,603 vs the quote, Rs 5,36,000 now + Rs 1,52,282 × 36, cash left 2.59 months. The table lists six
   Shariah-compliant options (true cost in today's money, cash left, a short tag). **How we worked this out** holds
   **Show calculation** per row, the **KIBOR stress** slider, the chart, Assumptions and Shariah notes. Press **Choose
   this** on **B, Ijarah 14.8%**: the card says **Your choice** and "Costs Rs 1,76,585 more than Islamic LTFF 8.5% in
   today's money"; the memo, bank request and dashboard follow the choice. **Use recommended** switches back.
6. **5 Decide:** **Write decision memo** (every number checked against the calculation). **Ask the bank for an offer**
   (the term-sheet request) stays blocked until you tick that the flagged account was confirmed by phone.
7. **Settings toggles:** switch the financing preference to **Islamic and conventional**, then on Compare press
   **Recalculate**: two conventional rows appear, tagged "Comparison only", and are never recommended. Turn on **Pay in
   full when we can afford it** and set cash to Rs 2,00,00,000: Compare now recommends **B, cash**, says Islamic LTFF
   would cost Rs 2,78,722 less after tax, and Decide says no bank is needed. Use **Load demo company** in Settings to put
   the profile back.

## Problem

SME owners make big purchase and borrowing decisions without a finance team. Four mistakes keep happening:

1. **The cost of paying later.** A "0% markup" plan is a deferred-price sale: permissible, but the price is higher than cash. In the demo, paying later costs 16.9% a year.
2. **Missed cheap Shariah-compliant financing.** Exporters buying new machinery can apply for SBP's Islamic LTFF, priced at policy rate − 3% (8.5% today by that formula; the bank confirms the actual rate), but many never ask.
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
| 1. Quote / Your need | One of the two starts above |
| 2. Price check | One sentence ("about 9% above the market"), then under *See prices*: quoted price vs the simulated benchmark median ("% above the benchmark") and the real web listings (median shown alongside); supplier and product reviews scored by code as good / mixed / red flags |
| 3. Other offers | One button, **Ask suppliers for prices**, finds suppliers and emails each a price request (RFQ). For the demo machine, two fictional suppliers (no web call); for any other item, Faisla searches the web for dealers (Tavily + AI, names and phones only as printed). RFQs are emailed to team test inboxes. The inbox is polled every 10 s; AI reads replies, Roman Urdu included ("67 hazar per unit"), and each confirmed price becomes an offer. "Paste a reply" is the fallback; "Add an offer from a link" reads one web listing |
| 4. Compare | Every way to pay: cash, the supplier's deferred-price plan, Diminishing Musharakah, Ijarah, Islamic LTFF (conventional rows only if the preference includes them). Leads with one answer card (best way to pay, savings vs the quote, what you pay, cash left), then a simple table (you pay, true cost = PV after tax, cash left, short tag). The owner can **Choose this** on any row: the card then shows "Your choice" and how much more it costs than the recommendation, and the memo (which says what Faisla recommended), the bank request and the dashboard follow the choice. *How we worked this out* holds PV before and after tax, full verdicts, "Show calculation" per row, KIBOR stress slider, chart, break-even discount rate, Assumptions and Shariah notes |
| 5. Decide | Decision memo built from the code's numbers (every number checked, Islamic finance terms), PDF export, Copy, and an "Ask the bank for an offer" (term sheet) email to an Islamic bank's SME desk (profit rate, takaful, security deposit, late-payment charity undertaking, Shariah board approval) with a 36-month installment schedule attached. If the recommendation is cash, no term sheet is needed and the button says so |

**Recommendation rule (code, `compareOptions`).** Among Shariah-compliant rows (cash, the supplier's plan, Islamic
financing), pick the lowest PV after tax that still leaves at least 2 months of fixed costs in the bank; if none does,
the lowest PV after tax. Conventional rows are never recommended. If the company turns on **Pay in full when we can
afford it**, the cheapest cash row that leaves 2 months of runway wins instead, and cheaper financing rows are marked
"Cheaper in today's money, but uses financing".

Around the decisions sits a management shell:

- **Dashboard:** cash, runway today and after committed purchases, savings found, upcoming installments and rentals, a 12-month cash chart, and alerts (runway drop, the cost of paying later on a "0%" plan, red-flag reviews, expiring quotations, term sheet to request).
- **Suppliers:** every supplier seen across decisions, merged by name, with reputation.
- **Financing:** the Islamic-first preference, a short explainer of each Islamic mode, KIBOR and policy-rate references, and the company's financing options (Islamic presets plus conventional), editable; used in every comparison.
- **Inbox:** every RFQ, reply and bank email across decisions.
- **Settings:** company profile (including the financing preference and "pay in full when we can afford it"), account,
  light/dark/system theme, and what is real vs simulated.

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
alert. **High risk blocks the "Ask the bank for an offer" (term sheet) action** until the owner ticks that they
confirmed the account by phone on a number they already had. Demo: confirm the demo quotation (its IBAN is kept on
file), then use **Demo → Demo fraud email** on the Other offers step.

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
or 8% off for cash (~9% above the simulated benchmark median of Rs 68,700; ~7% above the real web median of
Rs 70,000). Supplier B replies Rs 67,000 each (Rs 53.6 lakh).
Financing (Shariah-compliant only): 10% own share or security deposit, 36 months; Diminishing Musharakah and Ijarah
at 14.8% (an illustrative KIBOR of 11.8% + 3%; the 6-month KIBOR offer was 12.41% on 9 Oct 2026, which the stress
slider covers), SBP Islamic LTFF 8.5% (policy rate 11.5% − 3%, our arithmetic from SBP's published formula; the policy
rate was set on 28 Apr 2026 and held on 14 Sep 2026).

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

Every figure above is asserted in the unit tests. With **Pay in full when we can afford it** on and Rs 2 crore cash,
the recommendation becomes B, cash (4.18 months of runway, Rs 2,07,038 saved before tax against the "0%" plan); Islamic
LTFF stays Rs 2,78,722 cheaper after tax and the app says so. Also tested.

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
- The 60-row price benchmark table ("simulated benchmark", median Rs 68,700, set close to the real web median). The
  "% above" figure on the Price step uses this simulated median; the real web median is shown next to it.
- The cached supplier reviews (Al-Noor, Madina, Karachi Garment Tech); their links open real search pages, not the source of the quote.
- The demo reply texts (Supplier B's Roman Urdu reply and the fraud email). The app also reads real replies from the inbox.
- The bank's SME desk, which is a team test inbox.
- The tax profile (29%, 25% initial allowance + 15% reducing balance, 10-year life) is our reading of the Income Tax
  Ordinance 2001 for a company buying new plant and machinery, not tax advice; it is listed on every comparison.

**Real data:** the demo machine (Jack F5) and its cached web prices are real listings with links, collected
10 Oct 2026. Only three new-unit prices survive the cleaning: two on OLX (Rs 79,000 and Rs 70,000, Lahore) and a
Lahore dealer video (Rs 63,000); the rules drop a used Jack F6, a Jack F4 and two results without a PKR price, leaving
a median of Rs 70,000. Three prices is the minimum the app accepts, so treat it as an indication, not a market survey.
The cached Jack F5 product reviews are real (Amazon.de, Reddit, Facebook, a review site), each with its link.
With API keys set, a described need for anything else searches the live web and returns real listings, and
supplier replies arrive as real emails. All outgoing emails go only to team test inboxes, never
to real companies. SBP policy rate (11.5%, set 28 Apr 2026, held 14 Sep 2026), KIBOR (11.8%, illustrative), the
Islamic LTFF rate (8.5% = policy rate − 3%, our arithmetic) and the tax treatment are our best reading at the time of
the demo; banks must confirm them, which is why the app emails the bank for a term sheet. No real personal or
company data is stored: the demo account is fictional, and the only credentials in this README are for that account.

## Running locally

```bash
npm i
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm test           # 157 Vitest tests: finance engine, memo number check, reply parser, sourcing, reputation, quotation, fraud, dashboard
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

## Built during AICON'26

Everything in this repository was built by Team CodeStorm during the AICON'26 Build With AI period (10–11 Oct 2026);
the commit history starts with the scaffold on 10 Oct 2026. What we built:

- The finance engine (`src/lib/finance.ts`): effective cost of deferred-price plans, Islamic financing schedules,
  Ijarah and Diminishing Musharakah tax treatment, PV before and after tax, runway, break-even, stress test, the
  recommendation rule, and its tests.
- The AI pipelines (quotation vision extraction, need-to-search, listing and review reading, reply reading with a
  Roman Urdu parser cross-check, memo writing with a code number check) and the model benchmark that picked the models.
- The payment-fraud rules, the reputation scoring, the web app (five-step decision workspace, dashboard, suppliers,
  financing, inbox, settings), auth, the MongoDB data layer and the email safety rules.

Disclosures:

- **Planning documents.** `TECHNICAL_SPEC.md` and `PROJECT_PLAN.md` were written at the start of the event as the
  plan and keep their PROPOSED/SHOULD labels. Where they differ from the build, this README describes what was built.
  `reference/` holds the team's build-plan documents and `finance_reference.py`, the Python reference calculator
  used to check the demo numbers.
- **AI coding assistants** were used to write code and docs, as the rulebook allows. The team designed the product and
  the finance rules, reviewed the code and can explain every part of it.
- **Boilerplate:** `create-next-app` and shadcn/ui component templates (`src/components/ui`).

## Third-party APIs, libraries and data

| Name | Used for | Licence / terms |
| --- | --- | --- |
| OpenAI API (`openai` SDK, Responses API) | Vision extraction, structured output, emails and memo prose | SDK Apache-2.0; API under OpenAI's terms |
| Tavily | Web search | Tavily API terms |
| Gmail via `nodemailer`, `imapflow`, `mailparser` | Sending RFQs and bank email (SMTP), reading replies (IMAP) | MIT-0, MIT, MIT; one team Gmail account |
| MongoDB Node.js driver, MongoDB Atlas | Users, sessions, companies, decisions | Driver Apache-2.0; Atlas free tier |
| Next.js 16 (App Router), React 19, Vercel | App framework and hosting | MIT; Vercel hobby plan |
| Tailwind CSS v4, shadcn/ui (Base UI), lucide-react, sonner | UI components, icons, toasts | MIT, MIT, ISC, MIT |
| Recharts | Cost and cash charts | MIT |
| Zod | Validation of AI output and API input | MIT |
| next-themes | Light/dark/system theme | MIT |
| Vitest, TypeScript, ESLint | Tests, types, lint | MIT, Apache-2.0, MIT |
| Public web pages (OLX listings, a dealer video, Amazon.de, Reddit, Facebook, a review site) | Cached Jack F5 prices and product reviews | Short quotes and prices with links to the source, non-commercial demo |
| SBP, bank and news pages | Rates, scheme rules, Islamic finance references | Cited with links in [docs/ISLAMIC_FINANCE.md](docs/ISLAMIC_FINANCE.md) |

---

**Team CodeStorm** · AICON'26 Build With AI
