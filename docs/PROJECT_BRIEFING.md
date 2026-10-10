# Faisla project briefing (read this before the pitch)

Team CodeStorm · AICON'26 Build With AI · Domain: Financial Operations
Live app: https://faisla-xi.vercel.app · Login: `demo@faisla.pk` / `faisla2026` · Repo: https://github.com/NotHamxa/faisla

This takes about 15 minutes to read. For any term you don't know, see [GLOSSARY.md](GLOSSARY.md). For the recording and the live pitch split, see [DEMO_VIDEO_SCRIPT.md](DEMO_VIDEO_SCRIPT.md).

---

## 1. The one-line pitch

> **Faisla is a CFO in a box for small businesses. It shows the true cost of every way to pay for a big purchase, Islamic finance first, and writes the decision memo. AI reads the messy documents and emails, code does every rupee of maths, and the owner confirms.**

"Faisla" (فیصلہ) means "decision".

---

## 2. The problem, and why it matters in Pakistan

SME owners make big purchase and borrowing decisions without a finance team. Four mistakes keep happening.

| Mistake | What it looks like | In our demo |
| --- | --- | --- |
| 1. They don't see the cost of paying later | A "0% markup" installment plan sounds free, but the total is higher than the cash price | 12 × Rs 5,00,000 = Rs 60 lakh vs Rs 55.2 lakh cash. Paying later costs **16.9% a year** |
| 2. They miss cheap Shariah-compliant financing | Exporters buying new machinery can use SBP's Islamic LTFF at policy rate − 3%. Most never ask | Islamic LTFF at **8.5%** vs about 15% for normal Islamic bank financing |
| 3. They ignore tax | Profit, Ijarah rentals and depreciation reduce tax. That changes which option is cheapest | After tax, the saving is still **Rs 4.7 lakh** |
| 4. They run out of cash | Paying cash for the cheapest price can leave barely a month of salaries in the bank | Paying cash leaves **1.33 months** of costs. Islamic LTFF leaves **2.59** |

**Why it matters in Pakistan:**

- **Cash flow is the top SME pain.** In a 2020 SMEDA–ADBI survey of 236 Pakistani SMEs, 82% reported cash-flow problems. This was during COVID, so say "in a 2020 survey". ([SMEDA–ADBI report](https://smeda.org/phocadownload/Research_Publications/SMEDA%20-%20ADBI%20Report%20on%20Impact%20of%20COVID-19%20on%20SMEs.pdf))
- **Small firms lack finance.** The MSME finance gap in developing economies is estimated at **US$5.7 trillion** (SME Finance Forum / IFC, 2019 data). ([SME Finance Forum](https://www.smefinanceforum.org/news/11526737))
- **Islamic finance is now the default direction.** The 26th Constitutional Amendment (Oct 2024) commits Pakistan to eliminating riba **before 1 January 2028**. The Federal Shariat Court set 31 Dec 2027. Islamic banks already hold about 38% of bank financing. ([Arab News](https://www.arabnews.pk/pakistan/pakistan-sets-jan-1-2028-deadline-to-eliminate-riba-or-interest-from-country-2576082), [Dawn 2022](https://www.dawn.com/news/amp/1687367), [SBP Islamic Banking Bulletin Dec 2025](https://www.sbp.org.pk/assets/document/publications/Islamic_Banking_Bulletin_December_2025.pdf))
- **Payment fraud is common.** "Our bank account has changed, please pay today" emails hit SMEs that pay suppliers by bank transfer.

**Why it is Financial Operations, not procurement.** The core is financial planning (the true cost of credit, tax, liquidity) and credit and risk (financing choice, cash runway, fraud). Supplier search is just how Faisla gathers the numbers.

---

## 3. Who uses it and how

**User:** the owner or manager of a Pakistani SME (garments, plastics, pharma distribution, schools, cafés) about to buy something big: machines, a generator, vans.

**Two ways to start a decision** (the **New decision** dialog):

1. **I have a supplier's quotation.** Upload a photo or PDF, or take a photo. AI vision copies the printed fields. The owner confirms or edits each one.
2. **Describe what I need.** For example: "80 direct-drive lockstitch sewing machines for my garment factory in Faisalabad, budget around 60 lakh". AI turns this into a web search and reads the listings. Code drops listings without a written price, used items, wrong models, duplicates and outliers, then ranks the rest. The owner ticks 1 to 3 listings, and they become offers.

**The 6 steps.** The app shows five tabs ("Step 1 of 5" to "Step 5 of 5"). The fraud check is the sixth step: it has no tab, runs automatically on every quotation and email, and shows as a banner at the top. Slide 8 calls this the "5-step decision workspace". Same thing: if asked, say "five tabs, plus an automatic fraud check on every email".

| # | Step (tab name in the app) | What happens | Who does it |
| --- | --- | --- | --- |
| 1 | **Quotation** (or **Your need**) | Capture the offer: photo, PDF or typed. Arithmetic check: qty × price vs the printed totals, and the "0%" plan vs the cash price | AI reads, owner confirms, code checks |
| 2 | **Price & reputation** | Quoted price vs real web listings and a benchmark ("~9% above market"). Reviews of the supplier and the machine, scored Good / Mixed / Red flags | AI reads listings and reviews, code decides |
| 3 | **Competing offers** | Finds other suppliers, AI writes the RFQ email, Faisla sends it and checks the inbox every 10 seconds for 5 minutes. AI reads the replies, Roman Urdu included. Each confirmed price becomes an offer. "Paste a reply" is the fallback | AI writes and reads, code cross-checks the price |
| 4 | **Payment-fraud check** (automatic banner) | Compares bank details and senders across the quotation and every email. High risk blocks the term-sheet request until the owner confirms by phone | Code rules only |
| 5 | **Compare** | Every way to pay: cash, the supplier's deferred-price plan, Diminishing Musharakah, Ijarah, Islamic LTFF (conventional only if the owner asks). PV before and after tax, cash runway, verdict, "Show calculation", KIBOR stress slider, break-even rate, Assumptions card | Code only |
| 6 | **Decide** | One-page decision memo (every number checked), Download PDF, **Request term sheet** email to an Islamic bank's SME desk with a 36-month installment schedule | AI writes the words, code checks the numbers and writes the bank email |

**Around the decisions** sits a small management system:

- **Dashboard:** cash, runway, savings found, upcoming installments, a 12-month cash chart, alerts.
- **Suppliers:** a directory with reputation.
- **Financing:** the Islamic-first preference, explainers, reference rates, editable financing options.
- **Inbox:** all emails.
- **Settings:** company profile, the pay-in-full option, theme, and what is real vs simulated.

---

## 4. Where AI is, and where it isn't

**The rule: AI reads, code calculates, the owner confirms.** No number on screen is computed by an AI model.

- All AI calls go through one file (`src/lib/ai.ts`). It uses the OpenAI Responses API with strict, schema-checked JSON output.
- Every AI call returns "nothing" on failure. The app then uses cached data or a template, or asks the owner. It never guesses.

| AI task | Model tier (default model) | What code checks afterwards |
| --- | --- | --- |
| Read the quotation photo or PDF into fields | vision (`gpt-6-luna`) | qty × unit price vs the printed line total and grand total. "0%" plan total vs the cash price. IBAN checksum. The owner confirms every field |
| Turn a described need into a search request | fast (`gpt-4.1-nano`) | Budget and quantity are kept only if the owner actually wrote them |
| Read marketplace listings for a need | read (`gpt-6-luna`) | Each price must be written in that listing's text. Used items, wrong models, duplicates and outliers (outside 0.5× to 2× the median) are dropped. The median needs at least 3 prices |
| Clean web price results for the market check | fast | Used and wrong-model items and outliers are dropped. Fewer than 3 prices shows "Not enough market data". The median and "% above market" are computed in code |
| Read reviews into structured points | fast | The Good / Mixed / Red flags verdict comes from fixed code rules (`src/lib/reputation.ts`). Red flags go into the memo's risks and never change money figures |
| Write the RFQ email | write (`gpt-6-luna`) | A template is used if AI is down. Recipients are restricted to team test inboxes |
| Read supplier replies (Roman Urdu, lakh, hazar) | fast | A code parser re-reads the amounts written in the email and cross-checks the AI's price. If AI is down, the parser works alone. If the price is unclear, the owner is asked |
| Write the decision memo prose | write | Every number in the draft must match the code's list of facts. An unknown number means a retry (up to 2), then a code template |
| Add a quoted sentence to the fraud check | fast (part of reply reading) | The risk level always comes from the code rules |

**Code does everything else** (`src/lib/finance.ts`, pure TypeScript, no AI, unit-tested):

- the cost of paying later
- installments and rentals
- present value before and after tax
- depreciation
- runway
- break-even rate
- stress test
- ranking and verdicts
- the bank term-sheet email (a code template, no AI)

The models were chosen by a benchmark script (`scripts/models.live.ts`). It runs candidate models through the real routes on the real demo tasks and picks the most accurate, then the cheapest. A full demo run costs about **US$0.002** in AI usage.

---

## 5. Islamic finance first

**What changes in the app:**

- **Shariah-compliant by default.** Comparisons include:
  - **Diminishing Musharakah** (co-ownership)
  - **Ijarah** (lease)
  - **SBP Islamic LTFF** (for exporters)
  - **Murabaha** (cost-plus sale), available as a preset on the Financing page but not in the default demo set

  Cash and the supplier's deferred-price plan are also Shariah-compliant.
- **Conventional only on request.** The preference ("Shariah-compliant only" or "Islamic and conventional") is in Settings and on the Financing page. Conventional rows get a "Conventional · interest-based" badge, the verdict "Interest-based, for comparison only", and are **never recommended**.
- **Correct tax per mode.**
  - **Ijarah:** rentals are deducted as paid, with no depreciation for the lessee during the lease. After ownership transfers, 15% reducing balance on the purchase price.
  - **Diminishing Musharakah, Murabaha, Islamic LTFF:** deduct the profit, and the owner depreciates the machines (25% initial allowance, then 15% reducing balance).
- **Honest words.** Islamic products are never called "interest", "loan" or "EMI". We say profit rate, rental, installment and financing. The supplier's plan is a "deferred-price plan" with an "effective yearly cost", not "hidden interest".
- **Shariah notes on every comparison** (Assumptions card): asset-backed, no compounding, late payment goes to charity, takaful, and the bank's Shariah board must approve.
- **The term-sheet email** goes to an Islamic bank's SME desk and asks those exact questions.

**Why:**

- Pakistan must eliminate riba before 1 Jan 2028 (26th Amendment; Federal Shariat Court deadline 31 Dec 2027).
- Many owners will not take an interest-based loan at all.
- Islamic banks hold about 38% of bank financing.

**Is the "0% markup" plan haram?** No. A credit sale at a higher deferred price (bay' muajjal) is permissible when the price is fixed at the contract and nothing is added for late payment ([IIFA Resolution 51](https://iifa-aifi.org/en/32398.html)). Faisla still shows that it is the dearest way to pay in the demo.

**Final compliance is the bank's Shariah board's call, not ours.** That is why the term-sheet email asks for the approval or fatwa reference.

Sources and modelling details: [ISLAMIC_FINANCE.md](ISLAMIC_FINANCE.md).

---

## 6. The demo numbers and where each comes from

**Demo inputs (fictional company, real machine):**

- **Company:** Hamza Garments, Faisalabad, exporter. Rs 1 crore cash, Rs 35 lakh a month fixed costs, 29% tax, 15% discount rate.
- **Supplier A** (Al-Noor Industrial Machines): 80 × Jack F5 at Rs 75,000 = Rs 60,00,000. Either 12 × Rs 5,00,000 at "0% markup" (first installment one month after delivery), or 8% off for cash.
- **Supplier B** (Madina Sewing Solutions): replies "67 hazar per unit".
- **Financing:** 10% own share or security deposit, 36 months.

| Number | What it means | How Faisla computes it |
| --- | --- | --- |
| **Rs 55,20,000** | Supplier A cash price | Rs 60,00,000 × (1 − 8%) |
| **Rs 4,80,000** | Extra you pay on the "0%" plan | 12 × Rs 5,00,000 − Rs 55,20,000 (flagged on the confirm screen) |
| **~9% above market** | Supplier A vs the simulated benchmark | Rs 75,000 ÷ benchmark median Rs 68,700 − 1 = 9.2%. Against the real web median of Rs 70,000 (3 new listings: Rs 79,000, Rs 70,000, Rs 63,000) it is ~7% (75,000 ÷ 70,000 − 1 = 7.1%) |
| **16.9% a year** | Cost of paying later on the "0%" plan | Find the monthly rate r where Rs 55,20,000 = Σ Rs 5,00,000 ÷ (1 + r)^t, t = 1…12. r = 1.3067% a month. Yearly = (1 + r)^12 − 1 = 16.86%. The simple quote r × 12 = 15.7%. If the first installment were due on delivery it would be 20.3% |
| **Rs 53,60,000** | Supplier B cash price | 80 × Rs 67,000, read from the Roman Urdu reply |
| **14.8%** | Diminishing Musharakah and Ijarah profit/rental rate | KIBOR ≈ 11.8% + 3% spread (our assumption; banks confirm) |
| **8.5%** | SBP Islamic LTFF end-user rate | Policy rate 11.5% − 3% (the published formula; our arithmetic) |
| **Rs 5,36,000** | Own share / security deposit | 10% × Rs 53,60,000 |
| **Rs 48,24,000** | Bank's share financed | Rs 53,60,000 − Rs 5,36,000 |
| **Rs 1,52,282 / month** | Islamic LTFF installment | P·i·(1+i)^n ÷ ((1+i)^n − 1), P = 48,24,000, i = 8.5% ÷ 12, n = 36 |
| **Rs 1,66,753 / month** | Diminishing Musharakah installment and Ijarah rental | Same formula at 14.8% |
| **Rs 6,58,145** | Total profit paid on Islamic LTFF | Sum of the bank's remaining share × i over 36 months |
| **Rs 49,87,935** | Islamic LTFF cost in today's money (PV before tax) | Rs 5,36,000 now + 36 × Rs 1,52,282, each discounted at 15% a year (1.1715% a month) |
| **Rs 55,67,038** | "0%" plan PV before tax | 12 × Rs 5,00,000 discounted at 15% |
| **Rs 5,79,103 (≈ 5.8 lakh)** | Saving vs the "0%" plan, before tax | 55,67,038 − 49,87,935 |
| **Rs 40,13,687 / Rs 44,87,290** | PV after tax: Islamic LTFF / "0%" plan | Subtract tax saved each year (29% × (profit or rentals + depreciation)) at month 12, 24, …, discounted at 15% × (1 − 29%) = 10.65% |
| **Rs 4,73,603 (≈ 4.7 lakh)** | Saving vs the "0%" plan, after tax | 44,87,290 − 40,13,687 |
| **2.86 months** | Runway today, no purchase | Rs 1,00,00,000 ÷ Rs 35,00,000 |
| **2.59 months** | Runway with Islamic LTFF | (1,00,00,000 − 5,36,000) ÷ (35,00,000 + 1,52,282) |
| **1.33 months** | Runway paying Supplier B cash | (1,00,00,000 − 53,60,000) ÷ 35,00,000 |
| **8.84% (shown as 8.8%)** | Break-even discount rate | The rate at which Islamic LTFF's PV equals the Rs 53,60,000 cash price. Above it, financing beats cash. It equals 8.5% ÷ 12 compounded monthly: (1 + 0.085/12)^12 − 1 |
| **16.8%, Rs 1,71,509, Rs 55,50,038** | Stress test, KIBOR +2% | Diminishing Musharakah and Ijarah reprice. Islamic LTFF doesn't (it follows the SBP rate), so the recommendation is unchanged |
| **Rs 41,90,272 vs Rs 43,32,522** | Ijarah vs Diminishing Musharakah, after tax | Same cash flows (PV before tax both 54,11,012). Ijarah deducts rentals within 3 years. Diminishing Musharakah deducts profit plus depreciation over 10 years. The total deductions are equal, but Ijarah's come earlier |

**Where the 5.8 lakh comes from** (a judge may ask "isn't that just negotiation?"):

| Part | Amount |
| --- | --- |
| Cost of the "0%" plan vs paying A in cash (in today's money at 15%) | Rs 47,038 |
| Supplier B's lower price (55.2 vs 53.6 lakh) | Rs 1,60,000 |
| Islamic LTFF at 8.5% vs paying B cash, when money costs 15% | Rs 3,72,065 |
| **Total** | **Rs 5,79,103** |

So most of the saving (Rs 3.7 lakh) comes from choosing the right financing, not from haggling.

**The full comparison table** (default "Shariah-compliant only", sorted by PV after tax):

| Option | Pay | PV before tax | PV after tax | Runway (months) | Verdict |
| --- | --- | --- | --- | --- | --- |
| **B, Islamic LTFF 8.5%** | 5,36,000 + 36 × 1,52,282 | **49,87,935** | **40,13,687** | **2.59** | **Recommended** |
| B, Ijarah 14.8% | 5,36,000 + 36 × 1,66,753 | 54,11,012 | 41,90,272 | 2.58 | Safe, dearer than Islamic LTFF |
| B, cash | 53,60,000 now | 53,60,000 | 42,92,409 | 1.33 | Cheapest price, drains cash |
| B, Diminishing Musharakah 14.8% | 5,36,000 + 36 × 1,66,753 | 54,11,012 | 43,32,522 | 2.58 | Safe, dearer than Islamic LTFF |
| A, cash | 55,20,000 now | 55,20,000 | 44,20,541 | 1.28 | Salaries at risk |
| A, deferred-price plan ("0%") | 12 × 5,00,000 | 55,67,038 | 44,87,290 | 2.50 | Paying later costs 16.9% a year |

**The recommendation rule** (`compareOptions` in `finance.ts`):

1. Only Shariah-compliant rows can win.
2. Among those, keep the ones that leave **at least 2 months** of fixed costs in the bank.
3. Pick the one with the lowest after-tax PV.
4. **If "Pay in full when we can afford it" is on** (Settings): a cash option wins whenever it leaves at least 2 months. In the demo it doesn't (cash leaves 1.33), so the answer stays Islamic LTFF. With Rs 2 crore in the bank, it would switch to "B, cash".
5. If nothing leaves 2 months, the cheapest compliant row wins anyway, with a warning verdict.

---

## 7. The payment-fraud check

The classic SME fraud is a fake "please pay to our new account" email (business email compromise). Faisla already reads the quotation and every reply, so code rules check them (`src/lib/fraud.ts`).

| Signal | Level |
| --- | --- |
| IBAN in an email differs from the IBAN on the quotation or already on file | High |
| IBAN fails the format/checksum test (PK, 24 characters, ISO 13616 mod-97) | High |
| Account-change or urgency language ("account has changed", "pay today", "naya account", "aaj hi", "fauran") | Medium |
| Account title doesn't match the supplier name | Medium |
| Sender domain differs from the supplier's known domain, or moves from a company domain to free webmail | Medium |

**The demo fraud email** looks like Supplier A. It triggers four reasons:

1. New IBAN `PK59 ALFH …` ≠ the quotation's `PK76 MEZN …` (high)
2. "our bank account has changed" (medium)
3. Account title "Imran Qureshi" (medium)
4. Sent from gmail.com, not alnoor-machines.pk (medium)

The overall level is **High risk**.

Note that the fake IBAN *passes* the checksum. The checksum catches typos and made-up numbers. It does not catch a fraudster's real account. That is why the "differs from the account on file" rule matters most.

**What happens next:**

- A red banner appears at the top of the decision, and the email gets a badge.
- The warning goes into the memo's Risks and onto the dashboard alerts.
- **Request term sheet** is blocked until the owner ticks "I confirmed this account by phone on a number I already had (not one from the email)".

---

## 8. What is real and what is simulated (be precise)

| Real | Simulated / fictional (labelled in the UI) |
| --- | --- |
| The machine: Jack F5 direct-drive lockstitch | The company Hamza Garments, its cash, costs and tax profile |
| Jack F5 web prices: 2 new OLX listings in Lahore (Rs 79,000, Rs 70,000) and a Lahore dealer video (Rs 63,000), collected 10 Oct 2026, with links. Cleaning dropped a used Jack F6, a Jack F4, an Indian-rupee listing and a spec sheet | Supplier A's quotation (Al-Noor Industrial Machines) and the other suppliers (Madina Sewing Solutions, Karachi Garment Tech) |
| Jack F5 product reviews (Amazon.de, Reddit, Facebook, a review site), with links | The 60-row price benchmark (median Rs 68,700, "Simulated benchmark") |
| AI calls on the live site (vision, replies, memo) | Supplier reviews of Al-Noor, Madina and Karachi Garment Tech (tagged "simulated"; links go to real search pages) |
| Emails really sent and received through a Gmail test account, when mail keys are set | The bank's SME desk (a team test inbox) |
| The finance maths, Pakistani tax rules as we read them, and SBP formulas | The Supplier B reply and the fraud email are typed demo texts ("Use demo reply", "Demo fraud email"). A real emailed reply works the same way |
| "Describe what I need" with keys set searches the live web for anything | Rates: policy rate 11.5% and KIBOR 11.8% are reference values to verify. Banks must confirm, which is why the app emails for a term sheet |

**Important for the demo:**

- The **Use demo quotation** button loads the stored demo quotation *without* calling AI (the badge says "Demo data").
- To show the AI reading a document, **upload the photo**. The badge then says "AI read this".
- **Find other suppliers** returns the two demo suppliers. A live web dealer search exists in the API, but the button doesn't use it yet.

---

## 9. Architecture in plain words

```
Browser (React)  ──>  Next.js 16 app on Vercel  ──>  OpenAI (reads and writes words)
                         │                        ──>  Tavily web search (cached first)
                         │                        ──>  Gmail (send RFQs, read replies)
                         │                        ──>  finance.ts (all the maths, no AI)
                         ▼
                    MongoDB Atlas (users, sessions, companies, decisions)
```

- **The screen** is a React web app. It autosaves as you work, about every half second after a change.
- **The server** is Next.js on Vercel. Each step calls a small API route: `/api/extract`, `/api/market`, `/api/reviews`, `/api/suppliers`, `/api/rfq/send`, `/api/rfq/replies`, `/api/decide`, `/api/memo`, `/api/bank-email`.
- **The finance engine** (`src/lib/finance.ts`) is pure maths. Same input, same output, no internet, no AI, covered by unit tests.
- **The database** is MongoDB Atlas. Every query is limited to your own company.
- **Login:**
  - Passwords are hashed with scrypt.
  - Sessions are random tokens in an httpOnly cookie. Only a hash of the token is stored, and it expires after 7 days.
- **Email safety:** mail can only go to team test inboxes. Anything else is redirected. With no mail keys, emails are saved as "simulated".
- **Fallbacks everywhere:** cached search results, a template memo, a code reply parser, and the owner typing it in.

---

## 10. What we built during AICON'26 (and what we used)

**Built during the event.** All 16 commits in the repo are dated 10 Oct 2026 (11:00 to 19:50):

1. Scaffold, shared types, demo data, AI and email wrappers
2. The full demo path (quotation → market → offers → compare → memo)
3. MongoDB data layer, session login, theme
4. The management shell: dashboard, decisions, suppliers, financing, inbox, settings
5. Switch of the AI layer to the OpenAI Responses API, plus the model benchmark that picks the cheapest accurate model per task
6. "Describe what I need" sourcing path
7. Payment-fraud check
8. Real session checks on every AI and email route
9. Ledger redesign, real Jack F5 market data, onboarding fixes
10. Islamic finance first (Diminishing Musharakah, Ijarah, Islamic LTFF, Murabaha preset, correct tax per mode, Shariah notes, Islamic term-sheet email)
11. "Pay in full when affordable" option

Also built: automated unit tests for the finance engine, memo number check, reply parser, sourcing, reputation, quotation, fraud and dashboard. The slides say 145. The README says 113 (out of date). The working tree ran 157 on the evening of 10 Oct. Check `npm test` and quote one number consistently.

**What we used (disclose this, as the rulebook asks):**

- **APIs:** OpenAI API (vision, structured output, prose), Tavily (web search), Gmail via `nodemailer`, `imapflow`, `mailparser`, MongoDB Atlas, Vercel hosting.
- **Frameworks and libraries:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui components (standard boilerplate in `src/components/ui`), lucide-react icons, sonner toasts, Recharts, Zod, next-themes, Vitest.
- **AI coding assistants:** name the ones the team used. The rulebook allows them.
- **Planning material:** the build-plan documents and the Python reference calculator in `reference/`. Say honestly when they were written.

**What is ours:**

- the finance engine and its tax/Islamic modelling
- the "AI reads, code checks" pipeline (arithmetic check, market filters, reputation rules, reply cross-check, memo number check)
- the fraud rules
- the whole product flow

---

## 11. Impact and SDGs

**For one demo purchase:**

- Rs 5.8 lakh saved (Rs 4.7 lakh after tax)
- 2.59 instead of 1.33 months of costs kept in the bank
- a fraudulent payment request blocked
- a bank-ready term-sheet request sent

All of it from one photo, for about US$0.002 of AI.

**Efficiency.** It replaces days of calls, spreadsheets and guesswork with a few minutes. Every number is shown with its calculation.

**Industry relevance:**

- **SMEs:** better decisions.
- **Islamic banks:** clean, documented financing requests that name the right product.
- **SBP schemes** like Islamic LTFF: reach more of the exporters they were built for.

**SDGs:**

- **SDG 8, Decent work and economic growth.** Target 8.3 is the growth of SMEs "through access to financial services". Target 8.10 is access to banking. Keeping 2+ months of salaries in the bank protects jobs. ([UN SDG 8](https://sdgs.un.org/goals/goal8))
- **SDG 9, Industry, innovation and infrastructure.** Target 9.3 is access of small-scale industrial enterprises "to financial services, including affordable credit". Faisla points exporters to cheaper Islamic LTFF. ([UN SDG 9](https://sdgs.un.org/goals/goal9))
- **Secondary:** financial inclusion for owners who avoid interest-based finance on faith grounds, and fraud prevention that protects small firms' cash.

---

## 12. Limitations we admit honestly

- **Rates are reference values.**
  - KIBOR 11.8% is illustrative. The 6-month KIBOR offer was 12.41% on 9 Oct 2026.
  - The 8.5% Islamic LTFF rate is our arithmetic from the published formula.
  - SBP refinance schemes are being phased out over FY24–28.
  - Banks must confirm all of these. The stress slider shows the answer holds.
- **Tax is simplified.**
  - One tax rate (29%, the company rate), editable.
  - One depreciation profile for new plant and machinery (25% initial allowance + 15%, 10 years).
  - Tax savings arrive 12 months after delivery, not on 30 June.
  - No minimum tax, super tax, or exporter regime.
  - Murabaha and Diminishing Musharakah profit being deductible is standard practice, but we found no FBR text that says it explicitly.
- **Runway counts no sales income.** It is a worst-case floor, not a forecast. The 2-month safety line is a fixed rule, not editable.
- **Payment shapes.** Equal monthly installments only. No advance or down payment on supplier plans, and no grace periods (real Islamic LTFF allows up to 10 years with 2 years' grace; we model 36 months for a like-for-like comparison).
- **Supplier finder.** It returns the two demo suppliers in the app. Live dealer search isn't switched on from the UI. RFQs are email only, with no WhatsApp yet.
- **After the decision.** There is no "mark paid", no reminders, and no ledger. The dashboard assumes the recommended option was chosen.
- **Fraud check scope.** Pakistani IBANs, within one decision. No foreign or SWIFT accounts, and no company-wide payee registry yet.
- **Not financial or religious advice.** The owner decides. Shariah compliance is confirmed by the bank's Shariah board.

---

## 13. Roadmap

1. **WhatsApp intake:** quotations as photos, PDFs, voice notes and Roman Urdu text, plus RFQs over WhatsApp.
2. **Investment check:** "should I buy at all?" Payback, NPV and IRR from expected monthly savings (solar, generator, van).
3. **More payment shapes:** advances, post-dated cheques, "30 days credit", early-payment discounts.
4. **Asset-class tax profiles:** vehicles, computers, fit-out, buildings, used plant.
5. **Bank loan pack** with DSCR for the lender.
6. **After the decision:** chosen option, payment schedule, reminders, mark paid, cash ledger.
7. **Company-wide payee registry** for the fraud check, and a "check a payment request" box.
8. **Urdu UI**, a mobile camera-first app, and bank and accounting integrations (Raast, open banking).

---

## 14. Judge Q&A

Short answers first. Add a sentence only if the judge asks for more.

**AI depth**

1. **Where exactly is the AI?**
   It reads the quotation photo (vision), web listings, reviews and supplier emails in Roman Urdu. It writes the RFQ and the memo. That is nine AI tasks in total. It does not do the maths, on purpose.

2. **Isn't this just a calculator with a chatbot?**
   No chatbot. Without AI there is no input: no quotation fields, no market prices, no supplier replies. The calculator is the part we deliberately kept out of AI so it can be trusted.

3. **Can't ChatGPT do this?**
   ChatGPT can do the maths if you give it every number. Faisla collects the numbers:
   - reads the quotation
   - checks the market
   - finds and emails suppliers
   - reads their Roman Urdu replies
   - knows your cash and costs
   - applies Pakistani tax and SBP rules in tested code
   - catches the fraud email
   - writes a memo where every number is checked

   ChatGPT can also get the arithmetic wrong without telling you. Ours can't, because it's code with tests.

4. **Which models, and why?**
   `gpt-6-luna` for vision, messy pages and writing. `gpt-4.1-nano` for short reading tasks. A benchmark script runs candidate models on our real tasks and picks the most accurate, then the cheapest. The vision model read 12 of 12 quotation fields.

5. **How do you stop hallucinations?**
   - Strict JSON schemas.
   - The AI may only copy what is printed: "never compute totals".
   - Code checks every output: arithmetic, prices must appear in the source text, the reply parser cross-check, the memo number check against the facts list.
   - If a check fails: retry, then a template, then ask the owner.
   - No number on screen comes from AI.

6. **How accurate is the extraction?**
   12 of 12 fields on our test quotation. The owner still confirms every field, and code flags any total that doesn't add up.

**Finance**

7. **Why a 15% discount rate?**
   It is roughly what money costs this business: KIBOR about 11.8% plus a 3% bank spread is about 14.8%, rounded to 15%. It is editable in Settings. And the answer is robust: Islamic LTFF beats paying cash at any discount rate above 8.84%.

8. **Is 8.5% for Islamic LTFF real?**
   The published formula is end-user rate = SBP policy rate − 3% (ABL publishes this), and the policy rate is 11.5% (set April 2026, held 14 Sep 2026). 8.5% is that arithmetic. These schemes are being phased out over FY24–28, so the app emails the bank for a term sheet to confirm the rate, eligibility and approval time.

9. **How do we know 16.9% is right?**
   Click "Show calculation". It is the internal rate of return of paying 12 × 5 lakh instead of 55.2 lakh today, solved by bisection: 1.3067% a month, so 16.86% a year. The simple quote is 15.7%. If the first installment were due on delivery, it would be 20.3%. Timing is an input on the confirm screen.

10. **Why recommend financing over paying cash?**
    Two reasons:
    - In today's money, 36 installments at 8.5% (PV Rs 49.9 lakh) cost less than Rs 53.6 lakh now, because money costs this business 15%.
    - Cash leaves 1.33 months of salaries and rent in the bank. Islamic LTFF leaves 2.59.

11. **I prefer to pay in full. Can I?**
    Yes. Turn on "Pay in full when we can afford it" in Settings. Faisla then recommends cash whenever paying it still leaves at least 2 months of fixed costs. In this demo cash would leave only 1.33 months, so it still advises financing. With Rs 2 crore in the bank, it recommends paying Supplier B in cash.

12. **Can I pick a different option than Faisla recommends?**
    Yes. Every row on Compare has a "Choose this" button. The answer card then says "Your choice" and, honestly, what it costs: choosing Ijarah 14.8% costs Rs 1,76,585 more than Islamic LTFF in today's money. The memo, the bank request and the dashboard follow your choice, and the memo says Faisla recommended Islamic LTFF. "Use recommended" switches back. If you choose cash, the bank button says no bank is needed.

13. **Why a 2-month runway threshold?**
    It is a prudence rule: keep at least two months of salaries and rent in the bank. Runway counts no sales income, so it is a worst case. Below 1.5 months the verdict says "Salaries at risk". It is a fixed rule today; making it editable is easy.

14. **Did you include tax? Is it correct?**
    Yes:
    - 29% of profit (or Ijarah rentals) plus depreciation.
    - Depreciation is a 25% initial allowance in year 1, then 15% reducing balance, over 10 years, on what each option actually pays.
    - Tax savings are discounted at 10.65% after tax.

    Islamic LTFF still wins. The simplifications (one rate, no minimum tax or super tax, tax saved 12 months after delivery) are on the Assumptions card, and the tax rate is editable. A sole proprietor would enter their marginal rate.

15. **Why does Ijarah beat Diminishing Musharakah at the same 14.8%?**
    Tax timing. The cash payments are identical. With Ijarah you deduct the full rentals as you pay them, within 3 years. With Diminishing Musharakah you deduct the profit plus depreciation spread over 10 years. The total deduction is the same, but Ijarah's comes earlier, so it is worth more today.

16. **What's the difference between Ijarah and Diminishing Musharakah?**
    - **Ijarah:** the bank owns the machines and rents them to you. You pay a security deposit and rentals, the bank as owner handles takaful, and ownership passes to you at the end by a separate sale.
    - **Diminishing Musharakah:** you and the bank co-own the machines from day one. Each month you pay rent on the bank's share and buy some of its units, until you own all of it.

17. **What about fees, takaful and collateral?**
    The processing-fee field is on the Assumptions card. Change it and every row recalculates. Takaful and collateral are listed as not included, and the term-sheet email asks the bank for all three.

18. **How much of the 5.8 lakh is just Supplier B being cheaper?**
    Rs 1.6 lakh. Rs 3.7 lakh comes from choosing Islamic LTFF over paying cash, and Rs 0.5 lakh from avoiding the "0%" plan.

19. **What if rates change?**
    Use the stress slider. At KIBOR +2%, Diminishing Musharakah and Ijarah reprice to 16.8%, but Islamic LTFF follows the SBP rate, so the recommendation doesn't change.

**Shariah**

20. **Is this Shariah-compliant?**
    Islamic finance first:
    - By default only Shariah-compliant options are compared: Diminishing Musharakah, Ijarah, Islamic LTFF, and Murabaha as a preset.
    - Conventional rows appear only if the owner asks. They are labelled interest-based and never recommended.
    - Every comparison lists Shariah notes: asset-backed, no compounding, late payment to charity, takaful.
    - Final compliance is the bank's Shariah board's decision, so the term-sheet email asks for its approval reference.

21. **Isn't the "0% markup" plan riba?**
    No. A credit sale at a higher fixed deferred price (bay' muajjal) is permissible, as long as nothing is added for late payment (IIFA Resolution 51). We don't call it interest. We show its effective yearly cost so the owner can compare.

22. **Why is the Islamic profit calculated like a loan installment?**
    Pakistani Islamic banks price Diminishing Musharakah and Ijarah off KIBOR plus a spread. The schedule maths is the same annuity shape. What differs is the contract behind it (co-ownership or lease, real assets, no compounding, late payment to charity) and the tax treatment, which we model per mode.

**Fraud, data and trust**

23. **Won't the fraud check give false positives?**
    Some, by design, because a missed fraud costs far more than a phone call:
    - Only an IBAN change or a failed checksum is High.
    - Wording, title and domain alone are Medium: a warning, not a block.
    - The block clears with one tick after a phone call on a number you already had.
    - Name matching ignores words like "Pvt Ltd" and "Industrial", so "Al Noor Industrial Machines (Pvt) Ltd" still matches.

24. **What about data privacy?**
    - Passwords are hashed with scrypt.
    - Session tokens are stored only as hashes.
    - Every database query is limited to your company.
    - Outgoing mail can only reach whitelisted test inboxes.
    - AI sees only the document it is reading. We never ask for bank logins.
    - All demo data is fictional, as the rulebook requires.

25. **What does one decision cost to run?**
    About US$0.002 in AI calls for a full demo run, because cheap models do the easy reading. Hosting is Vercel and MongoDB Atlas.

26. **What's the business model?**
    - SMEs pay a monthly subscription.
    - Islamic banks pay for qualified, documented financing requests that name the right product.
    - Later, suppliers pay to be listed in comparisons.

27. **Does it scale?**
    - The maths is instant and runs anywhere.
    - AI calls are cheap and cached where possible.
    - Search results are cached.
    - The app is stateless on Vercel with MongoDB Atlas.

    The real scaling work is product, not infrastructure: WhatsApp intake, more payment shapes, more tax profiles.

28. **What if a supplier doesn't reply?**
    Faisla checks the inbox every 10 seconds for 5 minutes, then you can click "Check inbox now" or "Include last 24 h". The comparison works with any number of offers, even just the original quotation. A reply that arrives by WhatsApp or phone can be pasted in ("Paste a reply"). If the price is unclear, Faisla asks the owner rather than guessing.

29. **What's real and what's simulated?**
    - **Fictional:** the company, suppliers, supplier reviews, the benchmark table and the bank desk, all labelled.
    - **Real:** the Jack F5 web prices and product reviews (with links), the AI calls, and the emails through our test Gmail.
    - **Typed demo texts:** the demo reply and the fraud email. A real email goes through the same path.

30. **Is this financial advice?**
    It compares options for a business decision, shows every number and source, and the owner decides. Settings says "Not financial or religious advice".

31. **What did you build versus use?**
    - **We built:** the finance engine with Islamic modes and tax, the AI-plus-checks pipeline, the fraud rules, the whole app, and the automated tests (145 on the slides). That is all 16 commits, made during the event.
    - **We used:** OpenAI, Tavily, Gmail, MongoDB, Next.js, shadcn/ui and other open-source libraries, plus AI coding assistants. All are listed in the README.

32. **Is this really Financial Operations?**
    Yes:
    - **Financial planning:** the true cost of credit, PV, tax, liquidity.
    - **Credit and risk:** financing choice, runway, supplier reputation.
    - **Accounting automation:** quotation to structured data, arithmetic checks.
    - **Payments:** payment-plan choice.
    - **Fraud detection:** the payment-fraud check.

33. **What happens if the AI or internet is down during the demo?**
    - The demo quotation and the Jack F5 market data are cached.
    - The reply parser works without AI.
    - The memo falls back to a code template.
    - Emails are saved as "simulated".

    Worst case, we play the backup video.
