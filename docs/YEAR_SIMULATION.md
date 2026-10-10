# Faisla: a year in the life of five Pakistani SMEs

Product research, 10 Oct 2026. Based on the code at commit `9846ee3`. All five businesses are fictional. Facts about schemes, rates and tax are cited in [Sources](#sources).

## Executive summary

### Five biggest insights

1. **The engine is right for the demo's shape, but most real purchases have a different shape.** The demo shape is one machine, equal installments with no advance, and a 25% + 15% tax profile. Of the 44 simulated decisions, **17 (39%) broke at least one of those assumptions**: a multi-line quotation, an advance or down payment, or a non-machinery asset (vehicle, computer, fit-out, building, mould). Two of the gaps give **wrong answers, not just rough ones**:
   - Only quotation line 1 is priced (`quotationToOffer` uses `items[0]`).
   - An installment plan typed in without its advance totals less than the cash price. `hiddenMonthlyRate` then returns 0, and **Faisla recommends a 20–43% plan as the cheapest option**. This happened to Chai Shai's kitchen and Butt Plastic's machine.
2. **The biggest money is in short dealer plans and early-payment discounts, and the engine is one field away from them.** Hidden rates found:
   - **43% a year** on a "40% advance + 6 months, or 6% off for cash" kitchen plan.
   - **20% a year** on a moulding machine paid by PDCs (post-dated cheques).
   - **44% a year**: the cost of skipping a 3% early-payment discount.
   - **19.4% a year** for 60-day supplier credit, when the Export Finance Scheme costs 5.5%.

   The hidden-rate solver already exists. It only needs advance-payment and single-deferred-payment shapes.
3. **"Should I buy this at all, and which asset?" comes before "how do I pay?"** In **13 of the 44 decisions** the real question was one of these. In 9, the owner's first question was payback: solar four times, a generator, a school van, moulds, cold chain. In 6, they were comparing *different assets*, such as repair vs replace or generator vs battery (a few decisions were both). Faisla has no benefit side. Spec §10 (investment check) already describes the fix.
4. **WhatsApp is how suppliers quote. Email RFQs to two hard-coded sewing suppliers don't reach them.** Every business got quotes as WhatsApp photos, PDFs, voice notes or Roman Urdu text, and "Paste a reply" was the most-used feature. But it takes text only, drops installment and credit terms, and an offer can't be edited or deleted. The supplier finder always returns *Madina Sewing Solutions* and *Karachi Garment Tech*, because the UI never sends `live: true`. So step 3 only helps for the demo machine.
5. **The fraud check and LTFF are what owners would pay for, and both need to reach beyond one decision.**
   - **Fraud check:** it fired at all five businesses and stopped two large losses (about USD 27k and Rs 48 lakh). But most payment requests arrive outside a purchase decision. The "account on file" only exists within one decision, and foreign SWIFT accounts aren't checked at all.
   - **LTFF:** it saved Malik Rs 16.7 lakh of markup. But every new signup silently inherits the demo profile (`isExporter: true`, Rs 1 crore cash), so a café is told to apply for LTFF.

Runner-up: **nothing happens after the decision.** Writing the memo marks the decision "decided", and the dashboard assumes the recommended option was chosen. Payments are dated from the memo date, nothing can be marked paid, and the 12-month cash chart shows zero income. That makes it go **negative by month 3** for the demo company, which is the first thing a finance judge sees on the dashboard.

### Top 10 to build before the pitch (each ≤ 2 h, high demo value)

| # | Build | Where in the code | Why a finance judge will care |
| --- | --- | --- | --- |
| 1 | **Advance / down-payment installment plans** (plus a "single payment after N days" shape for supplier credit) | `Quotation`/`Offer` types (`advanceAmount`), `installmentOption` and `hiddenMonthlyRate` in `src/lib/finance.ts` (advance as a month-0 flow), "Totals and payment terms" in `QuotationStep.tsx`. Warn if installments total less than the cash price | The most common Pakistani dealer format. Shows "40% advance + 6 monthly, or 6% off cash = **43% a year**". Fixes a case where Faisla gives the wrong answer today. Demo numbers don't change (advance = 0) |
| 2 | **Asset-class tax profiles**: new plant and machinery / vehicle / computer / furniture and fit-out / building / used plant | `DEPRECIATION` and `taxDepreciation` in `finance.ts` become a per-class table, with a select on the quotation confirm screen. Shown in "Show calculation" and the Assumptions card | Initial allowance only for new plant; 10/15/30% rates; Rs 7.5m cap on vehicle cost [T1]. Proves the tax is Pakistani law, not a constant |
| 3 | **Investment check**: monthly saving or extra profit, plus life → payback months, NPV, IRR | New `investmentCheck()` in `finance.ts`, a card at the top of `ComparisonTable.tsx` (spec §10, P4) | Answers "should I buy at all?" (solar, generator, van). Turns Faisla from a payment calculator into capital budgeting |
| 4 | **Read installment, advance and credit terms from replies** ("6 qist 2.3 lakh", "40% advance", "30 din udhaar") | AI schema in `src/app/api/rfq/replies/route.ts`, plus the `replyParser.ts` fallback (it sets these to `null` today). Add a "Demo installment reply" button next to "Demo fraud email" | A live Roman Urdu WhatsApp reply becomes a row with a hidden rate. Shows the "AI reads, code calculates" split at its best |
| 5 | **Islamic financing types**: Ijarah and Diminishing Musharakah | `FinancingType` in `types.ts`, presets in `financing-manager.tsx` (Ijarah: 30% security deposit, KIBOR-linked rental, 1–5 years [R-IJ]), "Shariah-compliant" label in Compare and the memo. Same flows as a loan, KIBOR-linked so the stress test shifts them | Islamic banks hold **38% of bank financing** [R-ISL]. A Pakistani finance judge will ask about it |
| 6 | **Company-wide payee bank registry + a standalone "Check a payment request" box** | Build the on-file IBAN map from all decisions (`assessPaymentRisks` in `src/lib/fraud.ts` takes a `known` map). Paste box on `/inbox` or `/suppliers`. Treat a non-PK IBAN or SWIFT as "can't verify → medium" | "This supplier was paid to IBAN X in 3 earlier purchases; this email changes it." Catches fraud where it actually happens, outside a purchase |
| 7 | **Expected monthly inflow → an honest cash chart** | Profile field in `ProfileForm.tsx` and `Company`, `cashProjection` in `src/lib/dashboard.ts`, `cash-chart.tsx` (expected line solid, no-sales floor dashed). Runway stays labelled "floor" | Today the demo company's cash goes below zero in month 3. Fixes the least credible chart in the app |
| 8 | **Rate scenarios both ways + dated reference rates** | `SHIFT_STEPS` in `ComparisonTable.tsx` (−3% to +4%), "as of" dates on `/financing` (policy 11.5% set 28 Apr 2026, held 14 Sep 2026; 6M KIBOR 12.41% on 9 Oct 2026 [R-PR]) | Rates went down 1,150 bps and then up 100 bps in 18 months. Shows LTFF stays the best choice either way |
| 9 | **Bank loan pack + DSCR** | Input "monthly operating profit". DSCR = profit ÷ (EMI + existing debt service) in `memoFacts.ts`, the memo, and the attachment from `src/app/api/bank-email/route.ts` (spec §9, P2) | Covers "credit and risk assessment" from the lender's side. Bankers ask for DSCR first |
| 10 | **WhatsApp-ready Urdu / Roman Urdu summary** | 5-line summary built from `memoFacts` (template, or AI + `numberCheck`), with a "Share on WhatsApp" (`wa.me/?text=`) button in `MemoPanel.tsx` | The owner (Tariq, Haji Arif, Imran) reads the decision where he actually works. A visible localisation beat |

**Correctness fixes to make before the pitch (≤ 30 min each, not demo features, but a judge testing their own case will hit them):**
- (a) Price every quotation line in `quotationToOffer`.
- (b) Stop new signups inheriting `demoCompany` cash, costs and exporter flag in `createUserWithCompany` (`src/lib/server/repo.ts`). Default `isExporter: false` and send the user to `/settings`.
- (c) Make the supplier finder send `live: true` for non-demo items, or offer "Add supplier" by hand, so nobody sees sewing dealers for solar.
- (d) Add a "Remove" button on offer rows in `SupplierPanel.tsx`.
- (e) Reword "policy rate 11.5% since 14 Sept 2026" in `demoData.ts`, the README and PROJECT_PLAN. It was **set on 28 Apr 2026 and held on 14 Sep** [R-PR]. Label the 11.8% KIBOR as illustrative: the 6M KIBOR offer was 12.41% on 9 Oct 2026. Keep the demo numbers (the unit tests assert them) and point to the stress slider.

### Roadmap slide (mention, don't build)
WhatsApp Business intake and RFQs (photos, PDFs, voice notes) · the after-decision loop (chosen option, delivery date, payment schedule, mark paid, reminders, PDC register, cash ledger) · working-capital decisions (early-payment discounts, supplier credit, bulk stock, EFS, invoice discounting) · existing-debt register with refinance and KIBOR-reset impact · taxpayer profiles (AOP/sole proprietor slabs, minimum tax binding, super tax, 30 June timing, sales-tax input, s.153 withholding with an ATL check) · imports (USD, LC, landed cost, PKR scenarios) · roles, approvals and a two-person payment rule · bank-statement and accounting-software import, Raast/open-banking payments · Urdu UI and a camera-first mobile app.

---

## 1. Baseline: what Faisla does today (used for every walkthrough)

| Area | What exists (file) | Limits that matter in the simulation |
| --- | --- | --- |
| Signup and profile | Email/password, one user per company. Profile: city, exporter flag, cash, fixed costs, tax rate, discount rate (`ProfileForm.tsx`) | A new company copies the demo's numbers and `isExporter: true` (`repo.ts`). No revenue/inflow, no taxpayer type, no existing debt. Single user, no roles |
| Step 1: quotation | Vision extraction, owner confirms every field, live arithmetic check, multi-line form, manual entry, bank details read (`QuotationStep.tsx`, `/api/extract`) | Offer = **line 1 only**. No advance or down payment. No currency. No asset type. Original file isn't stored |
| Step 1 alt: describe a need | AI search request → web listings → code filters (used items, outliers, duplicates) → owner ticks 1–3 (`NeedStep.tsx`, `sourcing.ts`) | Used items always dropped. Works for retail-listed items, weak for EPC/turnkey jobs |
| Step 2: price and reputation | Web median + "% above market". Reviews scored good/mixed/red by code rules (`MarketCard`, `ReputationCard`) | Benchmark exists only for the demo machine. Many Pakistani vendors have fewer than 3 reviews ("not enough") |
| Step 3: competing offers | Finder → RFQ email → Gmail poll every 10 s for 5 min → AI + Roman Urdu parser → offer. "Paste a reply" fallback. Fraud check on each email (`SupplierPanel.tsx`) | Finder returns the 2 demo sewing suppliers for every item. Email only. Paste is text only. Reply offers have no installment or discount terms. Offers can't be edited or removed |
| Step 4: compare | Cash per offer, installments if quoted, bank and LTFF loans **on the cheapest offer**. PV before and after tax, runway floor, verdicts, show calculation, KIBOR slider **0 to +4%**, fee field, break-even rate, Assumptions card (`finance.ts`, `ComparisonTable.tsx`) | One depreciation profile (25% + 15%, 10 years) for every asset. Tax saving at month 12 after delivery, not at 30 June. No benefit side. No Islamic products. No grace periods. Runway ignores income |
| Step 5: decide | AI memo with every number checked (template fallback), print to PDF, term-sheet email with a plain-text repayment schedule. A high fraud risk blocks it (`MemoPanel.tsx`, `/api/memo`, `/api/bank-email`) | A memo existing = "decided" (`deriveStatus`). No "chosen option" or delivery date. No approval or share link. English only |
| Dashboard | Cash, runway now and after commitments, savings found, upcoming payments, 12-month no-sales cash floor, alerts (`dashboard.ts`) | No mark-paid, no reminders. Upfront amounts are subtracted from a cash balance that is never updated. The chart goes negative for any real business |
| Financing page | SBP reference rates, editable company-wide loan options (bank/LTFF), EMI calculator (`financing-manager.tsx`) | Types limited to `bank` and `ltff`. Rates hard-coded without an "as of" date. No per-decision quotes. No hidden-rate calculator |
| Fraud | PK IBAN checksum, IBAN change vs quotation or first email **within the decision**, urgency language in English and Roman Urdu, title mismatch, domain switch (`fraud.ts`) | No company-wide payee registry. No standalone check. No SWIFT/foreign accounts. No images or voice |
| Not built | — | WhatsApp, Urdu UI, payments ledger, reminders, bank or accounting integrations, FBR/ATL, inventory/working capital, imports/FX, existing debt |

## 2. Five businesses, one year each

Simulated year: **November 2026 to October 2027**. It covers one Ramadan (expected to start about 8 Feb 2027, Eid ul Fitr about 9–10 Mar, Eid ul Adha about 16–17 May [S20]), one federal budget (June 2027, Finance Act in force from 1 July), the 30 June tax year-end, and the SBP rate decisions in between.

Every walkthrough uses Faisla **exactly as built at commit `9846ee3`**. When a step doesn't exist, the owner falls back to a workaround, and that is logged. All five businesses and their numbers are fictional but sized from public sources. Rupee amounts in the walkthroughs are illustrative. Rates and amounts that the code computes were re-run with the same formulas as `src/lib/finance.ts`.

Each decision ends with a `Tags:` line. The tags point to the item IDs in section 4, and they were counted to get the frequency columns there.

---

### 2.1 Malik Sports International, Sialkot (football and glove exporter)

| | |
| --- | --- |
| Owner | Tariq Malik (56). Decides everything above Rs 5 lakh. Speaks Punjabi and Urdu, reads English slowly, and sends WhatsApp voice notes |
| Team | Son Usman (29, MBA, runs email, the laptop and the bank relationship), accountant Rizwan (QuickBooks + Excel), export manager, 180 workers |
| Legal form / tax | Private limited company, 29% corporate rate. Since the Finance Act 2024 its export income is taxed under the normal regime, and the export withholding is a minimum tax, not a final tax [T2] |
| Size | Turnover about Rs 20 crore a year (90% exports to EU and US buyers). Cash Rs 2.2 crore. Fixed costs Rs 95 lakh a month |
| Existing debt | Rs 3 crore term loan at 6M KIBOR + 3.5% (2023 vintage), and an export-refinance working-capital line |
| Season | EU spring/summer orders are booked Nov–Jan and shipped Feb–May. Ramadan and Eid mean a payroll bonus and an advance |
| Tech comfort | Usman: high. Tariq: low, so the memo has to be printable or sent on WhatsApp |

**D1 · Nov 2026 — Two thermo-bonding presses + a panel cutter from China through a Lahore agent (Rs 1.1 crore)**
- *Today in Faisla:* Usman photographs the agent's quotation. It has three lines: 2 presses, 1 cutter, and installation. Vision fills all three lines correctly. The arithmetic check passes. He confirms. The Compare tab shows LTFF at 8.5% next to the bank at 14.8%, and LTFF is recommended. Tariq is shown the memo printed.
- *Trust (critical):* the offer is built from **line 1 only** (`quotationToOffer` in `src/lib/quotation.ts` uses `items[0]`). The comparison prices **2 presses**, not the whole Rs 1.1 crore quotation. The market check and the RFQ are also built from line 1 only. Usman notices because the cash price in Compare is lower than the printed total.
- *Friction:* the agent quotes in USD with a PKR "estimate" and payment by LC. Faisla has no currency field, no LC margin, no customs/duty/landed-cost lines, and no scenario where PKR falls before the LC is retired.
- *Wish:* "Check my LTFF eligibility properly." The rule is at least 50% of sales exported, or US$5m of exports, whichever is lower [R-LTFF]. The app only has a yes/no "exporter" switch. "Let me pick the LTFF tenor (3, 5 or 10 years) and the **up to 2-year grace period** on 10-year loans" [R-LTFF]. The engine has no grace period: it always uses `amortisation` from month 1. "Remind me which documents the bank needs, and that approval takes weeks."
- *Delight:* LTFF (1st tier) against the bank loan on Rs 88 lakh over 5 years is EMI Rs 1,80,545 against Rs 2,08,429. That is **Rs 16.7 lakh less markup**, and Tariq has never asked his bank for LTFF. "Show calculation" convinced Rizwan.
- Tags: A1 C10 D2 E2 C2

**D2 · Dec 2026 — 250 kW rooftop solar for the stitching halls (≈ Rs 2.4 crore)**
- *Today in Faisla:* there is no solar template, so Usman uses "Describe what I need". The web listings are panel-only retail prices and don't match an EPC turnkey quote. He switches to uploading the quotation of an EPC (engineering, procurement and construction) contractor. Compare shows cash vs bank 14.8% vs LTFF. LTFF is offered because the company is an exporter. Whether a bank would use LTFF for rooftop solar is a question the app never raises. SBP's dedicated renewable-energy refinance scheme was **discontinued from 1 July 2024** [R-RE], so in practice solar goes through bank green products such as Bank Alfalah Green Energy (KIBOR + spread, up to 5 years, 3 months' grace) [R-GREEN].
- *Friction:* the real question is **"does it pay back, and how fast?"** That needs grid tariff, units saved, net-metering/net-billing buy-back and panel degradation. Faisla compares only **ways to pay** and has no benefit side. Rizwan builds the payback in Excel.
- *Trust:* the depreciation is the 25% initial allowance + 15% machinery profile. That is probably right for solar plant, but the Assumptions card doesn't say which asset class it assumed.
- *Wish:* "Payback in months and NPV (net present value) with tariff +10%/yr. Show what happens if the net-metering buy-back rate is cut again" [R-NM]. "The bank's green-finance product, with its tenor and insurance, as a preset."
- *Delight:* the KIBOR stress slider shows the bank option at +2% still beats paying 2.4 crore cash, which would drop runway to 0 months. Tariq likes that it says "salaries at risk" in plain words.
- Tags: C3 D2 D3 J4 C1

**D3 · Jan 2027 — PU/TPU material for a large EU order: pay now, or take 60 days' credit at +3% (Rs 1.2 crore)**
- *Today in Faisla:* there is no "stock purchase" or "supplier credit" mode. Usman tries to enter it as a quotation with an 8% cash discount and "1 installment". The installment form assumes the payment is one month after delivery, not two, and the credit price is a single lump. He gives up and does it on a calculator.
- *Wish:* "Cost of supplier credit vs my export-refinance line." The answer is 3% for 60 days ≈ **19.4% a year**. That is more than three times the Export Finance Scheme end-user rate of 5.5% (from 11 Feb 2026) [R-EFS]. Faisla's hidden-rate engine already solves this. It needs a single-deferred-payment shape and the label "supplier credit".
- *Annoyance:* he has to re-enter the same supplier as last year. There is no supplier master with saved terms.
- Tags: C9 C2 A7

**D4 · Feb 2027 — Balance payment for the presses (70%): the "Hong Kong account" email**
- *Today in Faisla:* the Chinese factory's balance invoice arrives on a new email thread. It isn't an RFQ reply, so Usman pastes it into D1 under "Paste a reply". The urgency patterns catch "our company account has changed". It is flagged **medium**, and the memo Risks list it.
- *Trust gap:* the new account is a **foreign account (SWIFT/HK)**. The IBAN rules only recognise Pakistani `PK..` IBANs (`isValidIban`/`IBAN_RE` in `src/lib/fraud.ts`), so the comparison against the account on file never runs. A real change of beneficiary bank doesn't reach **high**, and the term-sheet block doesn't trigger.
- *Wish:* "A **Check a payment request** box that isn't tied to a decision. Supplier bank accounts kept **company-wide** across all decisions, including SWIFT/BIC and beneficiary name."
- *Delight:* even at medium, the red banner and "confirm by phone on a number you already had" made Usman call the factory's WeChat contact. The change was fake. **Around USD 27k was not sent to a mule account.** This is the strongest story of the year.
- Tags: H1 H2 H3 A2

**D5 · Mar 2027 — Ramadan bonus + Eid advance (≈ Rs 1.3 crore out in three weeks)**
- *Today in Faisla:* the dashboard shows "runway 1.6 months", red, from cash ÷ fixed costs with **no income**. Export receipts of about Rs 1.6 crore are due in March, so the alert is noise. The 12-month cash chart goes **below zero in month 3** because it has no inflows.
- *Wish:* "Let me enter expected receipts (LC/export proceeds) by month, and Eid bonus months as extra outflow." Runway that knows about seasonality.
- *Trust:* Tariq: "If it says I'm bankrupt in May, why would I trust its loan advice?"
- Tags: C11 J2

**D6 · Apr 2027 — Reprice or move the old Rs 3 crore loan (KIBOR + 3.5%, or another bank's takeover at KIBOR + 2% with a 1% fee)**
- *Today in Faisla:* there is no "existing loan" concept. Usman fakes a decision: a "quotation" for Rs 3 crore with two financing options he types on the Financing page. The results are meaningless: the Rs 3 crore gets depreciated as machinery, and there is a "cash" row.
- *Wish:* "A **refinance check**: remaining balance, current spread, new spread, switching fee and break-even months." At a 1.5% spread saving on Rs 3 crore that is about **Rs 4.5 lakh a year** before tax, against a Rs 3 lakh fee, so break-even is in about 8 months.
- *Wish:* "Show what the loan costs if SBP **cuts** rates." The slider only moves KIBOR **up** (0 to +4%), but the last two years were cuts [R-PR].
- Tags: C8 C7 B3

**D7 · Jun 2027 — Budget week + 30 June year-end: buy the embroidery line now or in August?**
- *Today in Faisla:* Rizwan updates the tax rate in Settings after the budget. Nothing tells him which open decisions changed.
- *Trust (finance):* the engine credits the tax saving at **month 12 after delivery** (`afterTaxFlows`). Pakistan's tax year ends on 30 June. A machine in service by 30 June gets its initial allowance and first-year depreciation in **this** return, about 12 months earlier than the model assumes. For a June purchase the after-tax PV is overstated, and "buy before 30 June" is invisible.
- *Wish:* "Fiscal-year-aware tax timing, and a 'buy before 30 June saves Rs X' hint." "Super-tax and minimum-tax awareness: if the minimum tax binds, the extra deductions save nothing this year" [T2].
- Tags: C4 C5 J3

**D8 · Aug 2027 — Used Japanese embroidery machine (Rs 28 lakh) or new (Rs 65 lakh on LTFF)?**
- *Today in Faisla:* "Describe what I need" **drops used listings by design** (`rankListings` in `src/lib/sourcing.ts`). The used offer only comes in through "Paste a reply". The engine then gives the used machine the 25% initial allowance. The allowance isn't available for plant previously used in Pakistan [T1], and LTFF only finances new machinery.
- *Wish:* "Condition (new, imported used, locally used) as a field that drives tax and LTFF eligibility, and expected life/maintenance as an input."
- *Delight:* even without the fix, LTFF on the new machine shows a small after-tax gap against the used machine bought for cash. Tariq picks new, for warranty and buyer audits.
- Tags: A8 C1 D2 B6

**Year-end for Malik Sports:** about **Rs 16.7 lakh** markup avoided by using LTFF instead of the bank (D1), **one fraudulent transfer stopped** (D4), and the solar and refinance analysis done in Excel. Would renew: **yes, if the fraud check and LTFF continue to work**. Usman calls steps 2–3 (market and RFQ) "nice for machines, useless for everything else".

---

### 2.2 Chai Shai Co., Lahore (three cafés, opening a fourth)

| | |
| --- | --- |
| Owner | Sana Rauf (36, business graduate). Partner is her brother Hamid (operations). Both sign anything above Rs 10 lakh |
| Team | Ops manager Bilal, outsourced accountant (monthly visits), 70 staff |
| Legal form / tax | AOP (partnership), taxed on progressive slabs, not the 29% company rate. Restaurant sales tax goes to the Punjab Revenue Authority, and the POS must be integrated [R-POS] |
| Size | Sales about Rs 2 crore a month (spikes in Ramadan evenings and wedding season, dips in June heat). Cash Rs 60 lakh. Fixed costs Rs 85 lakh a month |
| Existing debt | None (bootstrapped). Landlord deposits tied up |
| Tech comfort | High. Runs everything from a phone. Suppliers (dairy, meat, oil, equipment dealers) all quote on WhatsApp |

**D1 · Nov 2026 — Kitchen equipment for outlet 4: combi oven, 2 fryers, under-counter chillers, hood (Rs 34 lakh list)**
- *Today in Faisla:* Sana signs up. **The company profile is silently copied from the demo**: Faisalabad, *exporter = yes*, Rs 1 crore cash, Rs 35 lakh costs (`createUserWithCompany` in `src/lib/server/repo.ts` spreads `demoCompany`). Only the name is hers. She uploads a WhatsApp photo of the dealer's quotation, which has 7 lines.
- *Trust (critical, x2):* (1) Compare offers **SBP LTFF** to a café, because the exporter flag came from the demo. It is "recommended", and the memo tells her to ask the bank for LTFF. (2) Only line 1 (the combi oven) is priced (A1).
- *Friction:* the dealer's terms are **40% advance, the balance in 6 monthly payments, or 6% off for cash**. The form has installment months and amount but **no advance/down payment**. If she enters 6 × 3.4 lakh with a cash price of 32 lakh, the installment total (20.4 lakh) is below the cash price. `hiddenMonthlyRate` returns 0, and the installment row looks **12 lakh cheaper than cash**: a dangerously wrong recommendation.
- *Wish / delight-if-fixed:* with the advance modelled, the plan hides **≈ 43% a year** (13.6 lakh now + 6 × 3.4 lakh against 32 lakh cash). Short dealer plans with a cash discount are where Faisla would save the most money. **Best pitch material of the café year.**
- *Repetitive:* "Supplier finder" returns **Madina Sewing Solutions and Karachi Garment Tech** for a combi oven. The finder always returns the two demo sewing-machine suppliers, because the UI never sends `live: true` (`SupplierPanel.tsx` → `/api/suppliers`).
- Tags: M1 A1 C2 B5 M2

**D2 · Dec 2026 — Fit-out of outlet 4 (Rs 1.5 crore contractor, paid by milestones 30/40/30)**
- *Today in Faisla:* there is no quotation in the usual sense, just a BOQ (bill of quantities) spreadsheet and milestone dates. She types one line, "Fit-out, qty 1". Compare offers cash vs bank. A milestone schedule can't be entered.
- *Trust:* fit-out is furniture, fixtures and building improvements. Initial allowance excludes furniture and buildings [T1], and buildings depreciate at 10%. Faisla applies 25% + 15%.
- *Wish:* "Payment milestones as a schedule. Which bank or scheme lends for fit-out? PM Youth Business loan tiers?" [R-PMYB]
- Tags: C2 C1 D2 B3

**D3 · Jan 2027 — Two delivery bikes (Rs 5.5 lakh total, dealer "0%" 12 months)**
- *Today in Faisla:* five tabs for a Rs 5.5 lakh decision. The market check and RFQ steps are pointless here. The useful part is the hidden rate: about 9% a year on "0%". The quickest route is the Financing page EMI calculator, but it has **no hidden-rate mode**.
- *Wish:* "A one-screen quick check: cash price, installment and months → true rate." The engine already does this.
- *Trust:* vehicles get no initial allowance [T1]. Small, but wrong.
- Tags: B2 C1

**D4 · Feb 2027 (Ramadan starts ~8 Feb) — Lock 3 months of cooking oil and rice at 5% off before an expected price rise (Rs 42 lakh)**
- *Today in Faisla:* there is no stock/bulk-buy model (storage, spoilage, cash tied up, price-rise probability). The dashboard says **runway 0.7 months** (Rs 60 lakh cash ÷ 85 lakh costs) **in the highest-sales month of the year**, because sales income is never counted.
- *Wish:* "Bulk-buy vs buy-monthly: discount and expected price rise against the cost of cash and storage." "A revenue line on the dashboard; Ramadan and Eid as seasonal multipliers."
- Tags: C9 C11 J2

**D5 · Apr 2027 — 30 kW solar for the DHA café (Rs 38 lakh)**
- *Today in Faisla:* the same gap as Malik's D2. No payback, no net-metering scenario. The bank's solar product (down payment, tenor, insurance) has to be typed as a generic "bank" option on the Financing page, and that option then applies to **every** decision, because financing options are company-wide.
- *Wish:* payback/NPV. Per-decision financing quotes ("Bank X offered *this* project 2% under KIBOR + 3"). A solar preset.
- Tags: C3 D3 D4

**D6 · Jun 2027 — Emergency: walk-in chiller compressor dies in a 45°C week (repair Rs 3.5 lakh vs new Rs 14 lakh)**
- *Today in Faisla:* Bilal photographs the technician's handwritten slip on his phone and vision reads it. But "repair vs replace" isn't a decision type, and there is no expected-life or energy-saving input. The answer is needed **within two hours**, and the 5-step flow isn't built for that.
- *Delight:* the phone upload works, and the arithmetic check caught the technician's total being Rs 20,000 more than the lines.
- *Wish:* "Repair vs replace with remaining life." "Share the quick result to Hamid on WhatsApp for approval."
- Tags: C13 B2 G1 F1

**D7 · Jul 2027 — Dairy supplier raises prices 12% after the budget. Ask three other dairies**
- *Today in Faisla:* the RFQ goes by **email** to test inboxes, but dairies answer on WhatsApp. Sana pastes three WhatsApp replies under "Paste a reply". Roman Urdu prices are read well ("doodh 245 per litre, 30 din credit"). But this is a **recurring monthly supply** priced per litre, while Faisla models a one-off capex purchase, and the "30 days credit" term is dropped (`replyParser` sets installment and discount fields to `null`).
- *Annoyance:* if a pasted reply is misread there is **no edit or delete for an offer**. The only option is "Start over" on the whole decision.
- *Wish:* "A copy-ready RFQ text for WhatsApp." "Recurring supply comparison per month, including credit days."
- Tags: G3 A2 A3 C9

**D8 · Sep 2027 — The "landlord's new account" WhatsApp**
- *Today in Faisla:* rent isn't a purchase decision. Sana opens an old decision and pastes the message into "Paste a reply" just to run the fraud check. It flags urgency ("aaj hi transfer karein, purana account band hai") in Roman Urdu. **Delight**, but the workaround is awkward, and the landlord's IBAN was never "on file".
- *Wish:* H2 standalone check, H1 company-wide payee registry including landlords and utilities.
- Tags: H2 H1

**D9 · Oct 2027 — POS terminals + PRA integration + inventory SaaS (Rs 9 lakh hardware + Rs 25k/month subscription)**
- *Trust:* computer hardware depreciates at **30%** [T1], but Faisla uses 15%. The subscription is an operating cost, and there is no way to include it.
- *Wish:* "Total cost of ownership over 3 years (hardware + subscription)."
- Tags: C1 C13

**Year-end for Chai Shai:** the biggest potential saving (the 43% dealer plan in D1) was **missed**, because advance payments aren't supported. Sana first saw an LTFF recommendation she couldn't use. Value came from the hidden-rate check on bikes and the Roman Urdu fraud catch. Would renew: **only with WhatsApp-first input and an advance-payment fix**.

---

### 2.3 Medline Distributors, Karachi (pharma distribution with a delivery fleet)

| | |
| --- | --- |
| Owner | Haji Arif (60). Prefers **riba-free (Islamic) financing** and banks with an Islamic bank. Son Faraz (31) runs operations and the tech |
| Team | 45 staff: 8 Suzuki vans, 15 motorbike order-bookers, a warehouse manager, and an accountant on desktop distribution software |
| Legal form / tax | Private limited, 29%. Distributors face advance-tax withholdings, and turnover-based minimum tax matters at thin margins [T2] |
| Size | Turnover about Rs 4 crore a month at about 8% gross margin. Receivables from about 600 pharmacies at 30–45 days. Principals want payment in advance or within 15 days. Cash Rs 80 lakh. Fixed costs Rs 38 lakh a month |
| Existing debt | Rs 2 crore running finance (KIBOR + 2.5%, renewed every year), 2 vans on Ijarah |
| Tech comfort | Faraz: medium-high. Haji Arif: phone and WhatsApp only |

**D1 · Nov 2026 — Three Suzuki Every vans (≈ Rs 84 lakh at about Rs 28 lakh each [R-COST]): dealer plan, bank Ijarah, conventional auto loan, or cash**
- *Today in Faisla:* Faraz uploads the dealer quotation. Compare gives cash, the dealer installments, a bank loan and **LTFF**, because the inherited demo profile says exporter (see M1). There is **no Ijarah or Diminishing Musharakah**. He adds a "bank" option and names it "Meezan Car Ijarah", but the engine treats it as a conventional loan with markup + depreciation. Under Ijarah the bank owns the vehicle, and the lease-rental tax rules (with vehicle caps) are different [T1][R-ISL].
- *Trust:* vehicles get **no initial allowance**, and passenger-vehicle depreciation is capped at a cost of Rs 7.5m [T1]. Faisla applies 25% + 15% on the full cost. Takaful/insurance, tracker and registration are missing from the Assumptions card.
- *Wish:* "Islamic products as real types: monthly rental, security deposit, takaful, KIBOR-reset rentals." "A word in the memo that the recommended option is Shariah-compliant."
- *Context:* Islamic banks hold **38% of all bank financing** in Pakistan (Dec 2025) [R-ISL]. For a buyer like Haji Arif, a comparison without Ijarah is incomplete. Meezan Car Ijarah needs at least a 30% security deposit, over 1–5 years [R-IJ].
- *Delight:* the dealer's "easy installments" (30% down + 24 × Rs 2.68 lakh) hide **≈ 9.1% a year**. That is cheaper than the bank at 14.8%. Faisla correctly says **take the dealer plan** once the advance is entered. Today that only works if Faraz types the advance as the "cash discount" difference, which he can't.
- Tags: D1 C12 C1 C2 M1

**D2 · Dec 2026 — Cold-chain refrigerators + converting one van to a reefer (Rs 26 lakh) to keep an insulin principal**
- *Today in Faisla:* a two-line quotation, so the A1 bug again (fridges priced, conversion dropped). The decision is driven by revenue ("the principal leaves without cold chain"), and Faisla has no benefit or revenue-at-risk input.
- *Wish:* "Payback from the contract margin I keep (Rs 6 lakh a month)."
- Tags: A1 C3

**D3 · Jan 2027 — A principal offers 3% off for paying a quarter's stock (Rs 1.5 crore) in advance, instead of 30-day credit**
- *Today in Faisla:* no trade-credit structure. **Workaround that works:** a quotation with a 3% cash discount and "1 installment of the full amount, 1 month after delivery". The hidden-rate engine then shows **≈ 44% a year** as the cost of *not* taking the discount, so take it, funded from running finance at about 14%. **Delight**, but nobody would find this workaround alone, and the labels say "installments".
- *Wish:* a named "early-payment discount" calculator. It is the same maths with different words.
- Tags: C9 B2

**D4 · Feb 2027 — Running finance renewal: the bank wants stock and receivables statements, projections and DSCR**
- *Today in Faisla:* nothing for working capital, and the term-sheet email only fits a capex loan.
- *Wish:* "A bank pack: DSCR (debt-service coverage ratio) from operating profit, receivables ageing, the existing facilities list." DSCR is already proposed in the spec (§9).
- Tags: I1 C8 L2

**D5 · Mar 2027 — Ramadan/Eid: ORS and supplement volumes up 40%, Eid bonuses, principals push stock**
- *Today in Faisla:* the dashboard shows runway with no receivables. The bonus month isn't modelled.
- *Wish:* expected collections and seasonality (C11). "Alert me when committed payments plus Eid bonus breach the running-finance limit."
- Tags: C11 E2

**D6 · Apr 2027 — Warehouse power: 30 kVA generator vs lithium UPS vs solar + battery (K-Electric outages)**
- *Today in Faisla:* three quotations, three *different assets*. Faisla compares **ways to pay for the same item** (offers are assumed to be the same thing from different suppliers). Generator fuel cost, solar savings and battery replacement can't be entered.
- *Wish:* "Compare alternatives, not just suppliers: 5-year total cost including fuel and maintenance."
- Tags: C13 C3 B3

**D7 · Jun 2027 — Fraud: "principal finance department" emails a changed bank account for a Rs 48 lakh stock payment**
- *Today in Faisla:* the payment isn't part of any purchase decision. Faraz pastes the email into an old van decision. The domain changed from the principal's domain to a look-alike, so **medium**. The IBAN is valid and at a new bank, but there's no earlier IBAN *in this decision*, so it can't reach **high**. The principal's IBAN has been the same on 40 earlier payments, but that history lives in the accounting system.
- *Delight:* the domain-switch reason ("sender domain differs from the supplier's known domain") made Faraz phone the principal. **Rs 48 lakh saved.**
- *Wish:* H1 (company-wide payee bank registry, importable from the accounting system), H2 (standalone check), H5 (two-person rule above Rs 10 lakh).
- Tags: H1 H2 H5 L2

**D8 · Jul 2027 — Budget changes withholding on distributors. Is the minimum tax now binding?**
- *Today in Faisla:* only one "tax rate" field. When turnover tax binds, extra deductions (markup, depreciation) save **nothing**. The after-tax PV advantage of loans and installments vanishes, and Faisla still shows it.
- *Wish:* taxpayer profile (C5), with a "minimum tax binding, so the tax shield is 0 this year" toggle.
- Tags: C5 J4

**D9 · Sep 2027 — Distribution software + 20 Android order-booking handsets (Rs 14 lakh + Rs 60k a month)**
- *Trust:* 30% depreciation for hardware [T1], and the SaaS is an operating cost (C1, C13). Multi-line quotation (A1).
- Tags: C1 C13 A1

**D10 · Oct 2027 — The two existing Ijarah rentals reset with 6M KIBOR. What does the next year cost?**
- *Today in Faisla:* there is no register of existing financing, so the dashboard "Upcoming payments" only lists decisions made in Faisla.
- *Wish:* "Add my existing loans and leases once. Show the total monthly debt service and the effect of a KIBOR move on all of them."
- Tags: C8 E1 C7

**Year-end for Medline:** the most value came from the **early-payment discount** workaround (D3: 3% a quarter, about Rs 4.5 lakh per quarter captured) and the **fraud catch** (D7). The biggest gaps were Islamic products and working capital. Would renew: **yes, if Ijarah is supported**. Haji Arif will not use a tool that only recommends conventional loans.

---

### 2.4 Margalla Model School, Rawalpindi (two campuses, 1,100 students)

| | |
| --- | --- |
| Owner | Mrs Farah Naqvi (55, principal-owner). Her husband (retired, ex-army) controls money. Purchases above Rs 15 lakh go to a family "board" over WhatsApp |
| Team | Admin officer Kamran (Excel, WhatsApp), part-time accountant, 95 staff |
| Legal form / tax | Family AOP (an assumption for this simulation; many schools are trusts with different tax). Progressive slabs, so the accountant uses 35% as the marginal rate |
| Size | Fee billing about Rs 82 lakh a month, with 85–90% collected. Fixed costs Rs 62 lakh a month. Cash peaks in Mar–Apr (admissions) and drops in Jun–Aug (summer vacation, slow fee collection). Cash Rs 45 lakh in November |
| Existing debt | None |
| Tech comfort | Low to medium. Mrs Naqvi wants a printed page in Urdu or plain English |

**D1 · Nov 2026 — 60 kW solar for campus 1 (three EPC quotes, Rs 1.0–1.2 crore)**
- *Today in Faisla:* Kamran uploads quote 1 and pastes quotes 2 and 3, which came as WhatsApp **PDFs/images**, as text by retyping them. "Paste a reply" takes **text only**, with no image or PDF. The quotes differ in panel tier, inverter brand and warranty. Compare ranks on price only, and warranty and delivery are shown on the offer cards but not in the ranking.
- *Friction:* no payback, no net-metering scenario [R-NM]. The board's only question was "how many years to recover?"
- *Delight:* the reputation card found a red-flag review for the cheapest EPC ("installed, then disappeared for warranty"). The board chose quote 2. **Delight that avoids a bad vendor.**
- *Wish:* image/PDF paste (A4), payback (C3), warranty-weighted comparison (B6), bank solar preset (D3).
- Tags: A4 C3 B6 D3

**D2 · Dec 2026 — Computer lab: 30 PCs + 4 interactive panels (Rs 39 lakh cash, or 25% advance + 12 × Rs 2.6 lakh)**
- *Today in Faisla:* the advance can't be entered (C2). With the advance, the plan hides **≈ 12.8% a year**, which is cheaper than a bank loan at 14.8%. The 30% computer depreciation is wrong (C1). The panels sit on line 2 and are dropped (A1).
- *Wish:* "Check the vendor is an active taxpayer, because withholding on our payment changes if not" [R-WHT].
- Tags: C2 C1 A1 L3

**D3 · Jan 2027 — School van (Toyota Hiace, ≈ Rs 1.3 crore) paid for by transport fees**
- *Today in Faisla:* a pure financing comparison. The decision really depends on **transport-fee revenue (40 children × Rs 6,000)** against driver, fuel and maintenance costs.
- *Trust:* vehicle depreciation and the no-initial-allowance rule (C1). There's also an Ijarah vs loan choice (D1).
- Tags: C3 C1 D1

**D4 · Mar 2027 — Admissions inflow, then planning for the summer cash trough**
- *Today in Faisla:* the dashboard can't take fee inflows. It shows the same alarming runway in **March (cash-rich)** as in **July (cash-poor)**. The trough is real: in 2025 Rawalpindi schools were closed 28 May–14 Aug and **barred from collecting advance fees** [R-SCH].
- *Wish:* a monthly inflow profile (fees by month and collection rate). A summer warning: "July cash will drop to X. Don't commit to the generator until fees arrive."
- Tags: C11 J2

**D5 · May 2027 — Heatwave + exams: 100 kVA generator now, or expand the solar battery bank**
- *Today in Faisla:* two different assets (C13), fuel cost (C3), and an urgent timeline (B2). The supplier finder suggests sewing-machine dealers (B5).
- Tags: C13 C3 B2 B5

**D6 · Jul 2027 — Summer renovation: washrooms and classroom repaint (contractor, Rs 22 lakh, 50% advance)**
- *Trust:* building works get 10% and no initial allowance [T1] (C1). Milestones (C2).
- *Wish:* "Send the memo to the family board with **Approve / Ask a question** buttons, instead of printing and photographing it."
- Tags: C1 C2 F1 G1

**D7 · Aug 2027 — Fraud: a "uniform supplier" sends new bank details on WhatsApp, and parents send fake fee-transfer screenshots**
- *Today in Faisla:* the supplier part works through Paste a reply (Roman Urdu urgency caught). The receivables side (fake Raast/IBFT screenshots from parents) is out of scope. Kamran asks for it, because it costs the school more every year.
- *Wish:* H2, H1. Roadmap: verify incoming payment proofs against the bank statement (H4).
- Tags: H2 H1 H4

**D8 · Sep 2027 — Campus 2 expansion loan (Rs 1.8 crore): the bank asks for a loan pack**
- *Today in Faisla:* the "Request term sheet" email with the repayment schedule as **plain text** impressed the bank officer. But it has no DSCR, fee-collection history or projections.
- *Wish:* I1 (loan pack + DSCR as a PDF), K1 (Urdu summary for the owner).
- Tags: I1 K1

**Year-end for Margalla:** saved one bad vendor (D1 reputation) and **avoided the wrong generator-vs-battery call** only because Kamran built a spreadsheet. Faisla was mostly the "memo printer". Would renew: **maybe, if it gets payback, a fee-inflow calendar and board approval by link**.

---

### 2.5 Butt Plastic Industries, Lahore (injection moulding for household goods and auto-part vendors)

| | |
| --- | --- |
| Owner | Imran Butt (47). Decides alone, by feel, and quickly. Voice notes in Punjabi |
| Team | Nephew Ali (24, BCom, keeps the accounts in Excel), a production supervisor, 40 workers, 12 Chinese injection machines |
| Legal form / tax | Sole proprietor, taxed on individual slabs. Customers (auto-part vendors) withhold tax on payments |
| Size | Turnover Rs 1.1 crore a month. Cash Rs 25 lakh. Fixed costs Rs 32 lakh a month (salaries, rent, fixed electricity charges). Customers pay in 60–90 days. Resin bought from Karachi traders, payable in advance |
| Existing debt | Rs 50 lakh term loan (KIBOR + 4%) and post-dated cheques (PDCs) to a machine dealer |
| Tech comfort | Imran: low (WhatsApp only). Ali: medium. Quotations arrive as photos of handwritten letterhead pads |

**D1 · Nov 2026 — New 280-ton injection machine: Rs 80 lakh cash, or 40% advance + 10 PDCs of Rs 5 lakh**
- *Today in Faisla:* Ali photographs the handwritten pad (Urdu and English mixed). Vision reads it, but the qty and the amount in words differ, so the arithmetic check flags it and Ali corrects it. **Delight.** He can't enter the advance. If he enters "10 × 5 lakh" with an 80 lakh cash price, **Faisla says the installments are 30 lakh cheaper than cash and recommends them**, because `hiddenMonthlyRate` returns 0 when installments total less than cash.
- *With the advance modelled:* the PDC plan hides **≈ 20.2% a year**, which is dearer than his bank at about 15%. The right answer is a bank loan or a refinance scheme, not the dealer.
- *Friction:* not a direct exporter, so no LTFF. He has heard of "SBP SME schemes", but the Refinance Facility for Modernization of SMEs was **discontinued from 1 July 2025** [R-SME]. The PM Youth Business loan (Tier 3: Rs 1.5–7.5m at 7%) [R-PMYB] is too small and age-limited. Faisla can't tell him which schemes are live. A dated scheme catalogue with eligibility would.
- Tags: C2 A4 D2 C1

**D2 · Dec 2026 — A new mould for an OEM part (Rs 18 lakh). The customer guarantees 40,000 pieces a year**
- *Today in Faisla:* it is a payback question (Rs 18 lakh against Rs 22 margin per piece), with no benefit input. The mould has a 3-year life, not the 10 years the model hard-codes (`DEPRECIATION.lifeYears` in `finance.ts`).
- Tags: C3 C1

**D3 · Jan 2027 — Buy 3 months of PP resin now (Rs 60 lakh) before a forecast +8% rise and a PKR slide**
- *Today in Faisla:* no stock decision, no FX scenario. Buying would cut runway to about 0 months (Rs 25 lakh cash). Faisla would flag "salaries at risk" if he could even enter it.
- *Wish:* C9, C10, C11 (customers' payments due in Feb).
- Tags: C9 C10 C11

**D4 · Feb 2027 — 100 kW factory solar after an industrial tariff hike (≈ Rs 1 crore)**
- *Today in Faisla:* the same payback gap. A bank solar loan has to be typed generically (D3). Net-metering buy-back is uncertain [R-NM].
- Tags: C3 D3 D4

**D5 · Apr 2027 — Fraud: the resin trader's munshi (clerk) sends a "new Meezan account" by voice note + screenshot**
- *Today in Faisla:* a **voice note** can't be processed, and a **screenshot** can't be pasted (text only). Ali types the IBAN by hand. It passes the checksum (mules have real accounts), and there's no earlier IBAN for this trader in Faisla. The fraud check says low/medium only because of "naya account".
- *Wish:* A4 (screenshot), A5 (voice note), H1 (registry). Imran: "Just tell me on WhatsApp, *ruk jao, pehle phone karo*" (stop, phone first).
- Tags: A4 A5 H1 H2 G2

**D6 · May 2027 — Emergency: hydraulic pump fails. A refurbished pump (Rs 4 lakh) today, or a new one (Rs 9 lakh) in 2 weeks?**
- *Today in Faisla:* too slow (B2). Repair vs replace (C13). Used/refurbished isn't a condition (A8).
- Tags: B2 C13 A8

**D7 · Jun 2027 — SBP cuts the policy rate. Should he pay off the Rs 50 lakh term loan early, or refinance?**
- *Today in Faisla:* no existing-loan register (C8). The slider only moves rates up (C7). He also has to decide whether to fire the PDCs early for a discount (C9).
- Tags: C8 C7 C9

**D8 · Aug 2027 — The largest customer stretches payment from 90 to 120 days**
- *Today in Faisla:* runway ignores receivables (C11). He wants to know whether invoice discounting or supply-chain finance from the customer's bank is cheaper than his running finance [R-SME]. That is working capital (C9).
- Tags: C11 C9 L1

**D9 · Oct 2027 — A used Suzuki Ravi pickup for deliveries (Rs 19 lakh on dealer installments)**
- *Trust:* used vehicle: no initial allowance, vehicle rates (C1, A8). The advance can't be entered (C2).
- Tags: C1 A8 C2

**Year-end for Butt Plastic:** Faisla would have **cost** Imran money in D1 if Ali had trusted the installment row, because the advance-payment bug inverts the answer. Value came from vision reading handwritten pads and the arithmetic check. Would renew: **no, not until WhatsApp-native input and advance payments work**. He is the largest segment (low-tech, WhatsApp-only manufacturers).

---

## 3. Year-end scorecard

| Business | Decisions | Money Faisla saved or protected | Where Faisla's answer was wrong or misleading | Done in Excel instead | Would renew? |
| --- | --- | --- | --- | --- | --- |
| Malik Sports (exporter) | 8 | Rs 16.7 lakh markup (LTFF vs bank). About USD 27k fraudulent transfer stopped | Line-1-only pricing (D1). Foreign account not checked (D4). Tax-year timing (D7). Used machine given the initial allowance (D8) | Solar payback, supplier credit, refinance | Yes |
| Chai Shai (cafés) | 9 | Hidden rate on the bike plan. Roman Urdu fraud catch (D8) | LTFF recommended to a café (inherited exporter flag). 43% kitchen plan shown as **cheaper than cash** without the advance (D1). Fit-out and POS depreciation wrong | Fit-out schedule, solar, bulk oil | Only with fixes |
| Medline (pharma distributor) | 10 | About 3% a quarter captured by taking the early-payment discount (≈ Rs 4.5 lakh a quarter). Rs 48 lakh fraudulent payment stopped | Ijarah treated as a conventional loan. Vehicle tax profile. Minimum-tax case overstates the tax shield | Running-finance pack, power alternatives | Yes, if Ijarah is supported |
| Margalla School | 8 | Avoided a red-flag solar EPC vendor | Computer and building depreciation. Runway alarm in the cash-rich month | Solar payback, van payback, generator vs battery | Maybe |
| Butt Plastic (moulding) | 9 | Arithmetic check caught a handwritten-quote error | **Would have recommended a 20% PDC plan as Rs 30 lakh cheaper than cash** (D1). Mould life 3 years, not 10 | Stock buy, solar, refinance, receivables | No (not yet) |

**Counting across all five:**
- **Fraud check:** fired at all 5 businesses.
- **Hidden-rate engine:** the reason owners trusted the app.
- **"Paste a reply":** the most-used feature.
- **Steps 2–3 (market check and RFQ):** useful for only about 8 of 44 decisions, the machines with a web presence.

---

## 4. Consolidated issues, upgrades and new features

Key:
- **Businesses:** MS = Malik Sports, CS = Chai Shai, MD = Medline, MM = Margalla, BP = Butt Plastic. "n tagged" is how many of the 44 decisions carry that tag. Where an item affects more decisions than were tagged, the column says so.
- **Effort:** S ≤ 2 h, M ≤ 1 day, L > 1 day, for this codebase.
- **Demo?:** whether it would visibly strengthen a 5-minute pitch to a finance judge.

### 4.A Data entry and capture

| ID | Item | Where | Hit by (frequency) | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Price every quotation line, not only line 1 | `quotationToOffer` (`src/lib/quotation.ts`). `MarketCard`, `SupplierPanel`, `ReputationCard` also read `items[0]` | MS, CS, MD×2, MM: 5 tagged, every multi-line quote | Money + trust (wrong comparison) | S | Yes, defensively: any real quote a judge offers breaks it |
| A2 | Edit or delete an offer row, add an offer by hand | Offer list in `SupplierPanel.tsx` | MS, CS: 2 tagged, every misread paste | Time | S | No |
| A3 | Read installment, advance, discount and credit-days terms from replies | AI schema in `/api/rfq/replies`, `replyParser.ts` (sets `null` today) | CS tagged. About 6 decisions with WhatsApp dealer quotes | Money | S–M | **Yes**: live "6 qist" reply → hidden-rate row |
| A4 | Paste a screenshot, PDF or photo as a reply (vision) | "Paste a reply" in `SupplierPanel.tsx`, reuse `/api/extract` | MM, BP×2: 3 | Time | M | Yes |
| A5 | Voice-note transcription (Urdu/Punjabi) into reply text | New route | BP: 1 tagged. A habit of all 5 owners | Time / adoption | M–L | Risky live |
| A6 | Store the original quotation file for the bank or auditor | `QuotationStep.tsx` keeps an object URL only | Every decided purchase | Trust | M | No |
| A7 | Supplier master with saved terms and contacts that pre-fills new decisions | `/suppliers` is derived and read-only (`directory.ts`) | MS: 1 tagged. Repeat suppliers at all 5 | Time | M | No |
| A8 | Allow used or refurbished items with a condition field (drives tax and LTFF eligibility) | `rankListings` (`sourcing.ts`), `filterMarketPrices`, `Offer` | MS, BP×2: 3 | Money | M | No |

### 4.B Decision workflow

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Explicit "we chose option X" + delivery date. A memo no longer means "decided" | `deriveStatus` (`repo.ts`). `recommendedRow`, `paymentSchedule` (`dashboard.ts`) | Every decided purchase (~30/yr across the 5) | Trust in the dashboard | S | Medium |
| B2 | One-screen quick check: cash price + plan → true rate (also discount and refinance) | "Loan cost calculator" in `financing-manager.tsx` | CS×2, MD, MM, BP: 5 | Time | S | **Yes**: a 20-second answer |
| B3 | Decision templates (solar, vehicle, fit-out, stock, refinance, repair vs replace) | `new-decision-dialog.tsx` | MS, CS, MD: 3 tagged, about half of all decisions | Time | M | Medium |
| B4 | Duplicate a decision or re-quote after expiry | Row actions in `decisions-view.tsx` | Expired quotes | Time | S | No |
| B5 | Supplier finder that works for any item (live search or manual add) | `findSuppliers` in `SupplierPanel.tsx` never sends `live: true`. `/api/suppliers` demo list | CS, MM tagged. About 30 of 44 decisions are non-garment | Trust / time | S | Yes, if a judge tries their own item |
| B6 | Delivery, warranty and reputation in the ranking, not only on the cards | `ComparisonTable.tsx` (ignores `Offer.deliveryDays` and `warrantyMonths`) | MS, MM: 2 | Money (quality) | S | Medium |

### 4.C Finance engine depth

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Asset-class tax profiles: initial allowance only for new plant; 10/15/30%; Rs 7.5m vehicle cap; asset life | `DEPRECIATION`, `taxDepreciation` (`finance.ts`), select on the confirm screen | **All 5: 13** (most frequent) | Money + trust | S–M | **Yes** |
| C2 | Advance or down payment, then milestones, PDCs, grace periods (LTFF up to 2 years), single deferred payment | `installmentOption`, `hiddenMonthlyRate`, `amortisation` (`finance.ts`), `Quotation` | **All 5: 9**. Can invert the answer | Money | S (advance), M (the rest) | **Yes** |
| C3 | Benefit side: payback, NPV and IRR from monthly savings or profit | New `investmentCheck()` + card in `ComparisonTable.tsx` (spec §10) | **All 5: 9** | Decision value | S–M | **Yes** |
| C4 | Tax savings timed to the 30 June tax year-end, plus a "buy before 30 June" hint | `afterTaxFlows` (saves at month 12y) | MS: 1 tagged, affects every May–June purchase | Trust (finance judge) | M | Mention |
| C5 | Taxpayer profile: company 29%, small company 20%, AOP or individual slabs, minimum tax binding, super tax | `Company`, `afterTaxRate` | MS, MD: 2 tagged. 3 of the 5 businesses aren't 29% companies | Trust | M | Mention |
| C6 | Loans on every offer, not only the cheapest | `buildOptions` | Implicit wherever offers differ in quality | Money | S | No |
| C7 | Rate scenarios down as well as up; fixed vs floating | `SHIFT_STEPS` in `ComparisonTable.tsx` (0 to +4%) | MS, MD, BP: 3 | Trust | S | **Yes** |
| C8 | Existing debt register + refinance or prepay check | New. Dashboard | MS, MD×2, BP: 4 | Money (Rs 4.5 lakh a year at MS) | M–L | Roadmap |
| C9 | Working capital: early-payment discount, supplier credit, bulk stock, EFS or running finance | New flow shapes in `finance.ts` | MS, CS×2, MD, BP×3: 7 | Money (largest rupee amounts) | S (calculator), M–L (full) | Yes (calculator) |
| C10 | Imports and FX: USD price, LC margin, landed cost, PKR scenarios | `Offer` currency | MS, BP: 2 | Money | M–L | Roadmap |
| C11 | Inflows and seasonality in runway and the cash chart | `Company`, `buildDashboard` (`dashboard.ts`), `cash-chart.tsx` | **All 5: 6** | Trust | S (one number), M (monthly profile) | **Yes** |
| C12 | Lease / Ijarah tax treatment (rentals, vehicle caps) | `finance.ts` after-tax | MD: 1 | Trust | M | No |
| C13 | Compare alternatives (repair vs replace, generator vs battery, buy vs lease) with running costs | The offer model assumes the same item | CS×2, MD×2, MM, BP: 6 | Decision value | M | Roadmap |
| C14 | Sales-tax input credit and s.153 withholding on payments (double rate for non-ATL) [R-WHT] | `Quotation` fields | MM: 1 | Money / compliance | M | No |

### 4.D Financing products

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Islamic products: Ijarah, Diminishing Musharakah (security deposit, KIBOR-linked rental, takaful) | `FinancingType` (`types.ts`), presets in `financing-manager.tsx`, labels in Compare and the memo | MD, MM: 2. MD won't adopt without it | Adoption | S (basic) | **Yes** (38% of financing) |
| D2 | Dated SBP scheme catalogue with eligibility: LTFF ≥50% exports or US$5m; EFS 5.5%; PMYB&ALS tiers; discontinued schemes flagged | "Reference rates" on `/financing`, `isEligible` | MS×3, CS, BP: 5 | Money | M | Medium |
| D3 | Bank product presets: green/solar, auto, Ijarah | `financing-manager.tsx` | MS, CS, MM, BP: 4 | Time | S | Low |
| D4 | Per-decision financing quotes (financing is company-wide today) | `DecisionRecord` | CS, BP: 2 | Accuracy | S–M | Low |
| D5 | "As of" date and KIBOR tenor on every rate | `POLICY_RATE`, `KIBOR` in `demoData.ts`, `/financing` | All, every comparison | Trust | S | **Yes** |

### 4.E Payments and reminders

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | Payment schedule from the chosen option and delivery date; mark paid | `paymentSchedule` (`dashboard.ts`) | Every financed decision (~20/yr) | Retention | M | Medium |
| E2 | Reminders for EMIs, PDCs, quote expiry and LTFF documents, by email or WhatsApp | None (spec S3) | MS, MD: 2 | Money (late fees) | M | Low |
| E3 | Cash ledger: a payment reduces cash once. Fixes the double count of `committedUpfront` against a stale `cashBalance` | `buildDashboard` | All, as soon as they update cash | Trust | M | No |
| E4 | PDC / cheque register | New | BP, CS | Money | M | No |

### 4.F Collaboration and roles

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Share a memo link with Approve / Ask a question (partner, family board, accountant, bank) | `MemoPanel.tsx`, public token route | CS, MM: 2 tagged. All 5 have more than one approver | Time / trust | M | Medium |
| F2 | Multi-user roles and approval thresholds | `users` / `companies` collections | All | Controls | L | Roadmap |
| F3 | Audit trail of who changed which number | Decision PATCH route | Accountants | Trust | M | No |

### 4.G Communication channels

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | "Share on WhatsApp" summary (`wa.me`) | `MemoPanel.tsx` | CS, MM: 2 | Time | S | **Yes** |
| G2 | WhatsApp Business API intake and RFQs (per-message pricing [R-WA]) | New | BP, plus the habit of all 5 | Adoption | L | Roadmap |
| G3 | Copy-ready RFQ text for WhatsApp; RFQs to real suppliers with consent | `SupplierPanel.tsx` | CS: 1 | Time | S | Low |

### 4.H Fraud and controls

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | Company-wide payee bank registry (the on-file map is per decision today) | `assessPaymentRisks` (`fraud.ts`) | **All 5: 5** | Money (largest single losses) | S–M | **Yes** |
| H2 | Standalone "Check a payment request" (email or WhatsApp text, outside a decision) | New card on `/inbox` or `/suppliers` | **All 5: 5** | Money. Raast payments settle in seconds [R-RAAST] | S | **Yes** |
| H3 | Foreign accounts: SWIFT/BIC and non-PK IBAN, "can't verify → medium" | `IBAN_RE`, `isValidIban` (PK only) | MS: 1 | Money (import payments) | S | Medium |
| H4 | Verify incoming payment proofs (fake transfer screenshots) | New | MM: 1 | Money | L | Roadmap |
| H5 | Two-person rule above a threshold | Needs F2 | MD: 1 | Controls | M | Mention |

### 4.I Reporting and exports

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | Bank loan pack + DSCR (spec §9) | `/api/bank-email`, `memoFacts.ts` | MD, MM: 2 | Credit access | S–M | **Yes** |
| I2 | Excel/CSV export of the comparison and schedules | `ComparisonTable.tsx` | Every accountant | Time | S | Low |
| I3 | Portfolio view: total EMIs, debt maturity, savings by year | Dashboard | — | Insight | M | Low |
| I4 | Fixed-asset register entry with the tax-depreciation schedule for the accountant | New | — | Time | M | No |

### 4.J Trust and explainability

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| J2 | Cash chart with zero income goes negative: label it as a floor and add an expected line (pairs with C11) | `cash-chart.tsx` | MS, CS, MM: 3 tagged. Every dashboard view | Trust | S | **Yes** |
| J3 | "What flips the decision" sensitivity (discount rate, tax rate, tenor) | `ComparisonTable.tsx` | MS: 1 | Trust | M | Medium |
| J4 | Assumptions card names the asset class, taxpayer type and rate date | `buildAssumptions` | MS, MD: 2 | Trust | S | Yes (with C1) |

### 4.K Localisation

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| K1 | Urdu / Roman Urdu memo summary, number-checked | `MemoPanel.tsx`, `memoTemplate.ts`, `numberCheck.ts` | MM: 1 tagged. Every owner reads in Urdu or Punjabi. Roman Urdu is the dominant written form [R-RU] | Adoption | S–M | **Yes** |
| K2 | Urdu UI (right-to-left) | App-wide | All | Adoption | L | Roadmap |
| K3 | Type "13.4 lakh" or "1.2 crore" into money fields (the parser already exists) | Inputs in `QuotationStep.tsx` and `ProfileForm.tsx`, reuse `replyParser.ts` | All | Time | S | Low |

### 4.L Integrations

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | Bank-statement upload → cash, fixed costs, inflows | New | BP | Time | M | Roadmap |
| L2 | Accounting-software import (payees, IBANs, loans) | New | MD×2 | Time | L | Roadmap |
| L3 | FBR ATL status of a supplier (sets the withholding rate) | New | MM | Money | M | Low |
| L4 | Raast / open-banking payment initiation (e.g. BankIslami aik Connect [R-OB]) | New | — | Time | L | Roadmap |

### 4.M Onboarding

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | Signup copies the demo profile (exporter, Rs 1 crore, Rs 35 lakh) | `createUserWithCompany` (`src/lib/server/repo.ts`) | CS, MD tagged. Every real signup, all 5 | Trust (wrong LTFF advice) | S | No, but fix it |
| M2 | Sector presets and a guided setup in plain language | `ProfileForm.tsx` | CS | Time | S–M | Low |
| M3 | Sample decisions per sector (café, school, distributor) | `seed.ts` | — | Pitch breadth | S | Medium |

### 4.N Mobile

| ID | Item | Where | Hit by | Impact | Effort | Demo? |
| --- | --- | --- | --- | --- | --- | --- |
| N1 | Camera-first flow and compact comparison cards on the phone | `ComparisonTable.tsx` (wide table) | CS, BP (phone-only owners) | Adoption | M | Low |
| N2 | PWA / offline drafts | App-wide | Field staff | Adoption | M | No |

---

## 5. Ranked shortlist

**Top 10 to build before the pitch (each ≤ 2 h, high demo value).** Ranked by money impact × frequency × visibility. Each one is detailed in the executive summary.
1. Advance / down-payment installment plans (C2-lite + guard), in `finance.ts` and `QuotationStep.tsx`
2. Asset-class tax profiles (C1 + J4), in `finance.ts` and the confirm screen
3. Investment check: payback, NPV, IRR (C3), in `finance.ts` and `ComparisonTable.tsx`
4. Installment and credit terms read from replies (A3), in `/api/rfq/replies` and `replyParser.ts`
5. Ijarah and Diminishing Musharakah (D1-lite), in `types.ts` and `financing-manager.tsx`
6. Company-wide payee registry + "Check a payment request" (H1 + H2, H3 as medium), in `fraud.ts` and `/inbox`
7. Expected monthly inflow → honest cash chart (C11-lite + J2), in `ProfileForm.tsx`, `dashboard.ts` and `cash-chart.tsx`
8. Two-way rate slider + dated rates (C7 + D5), in `ComparisonTable.tsx` and `/financing`
9. Loan pack + DSCR (I1), in `memoFacts.ts` and `/api/bank-email`
10. WhatsApp-ready Urdu / Roman Urdu summary (K1 + G1), in `MemoPanel.tsx`

**Correctness fixes, 30 minutes each:** A1, M1, B5, A2, and the rate wording (section "Executive summary").

**Roadmap slide items (mention, don't build):**
- G2, A4, A5: WhatsApp-native capture and RFQs
- B1, E1–E4: the after-decision loop (payments, reminders, PDCs, cash ledger)
- C9: working capital
- C8: existing debt and refinancing
- C4, C5, C14, L3: full Pakistani taxpayer model
- C10: imports and FX
- C13: alternatives and total cost of ownership
- F1–F3, H5: roles, approvals and controls
- L1, L2, L4: bank, accounting and payment integrations
- H4: receivable-proof fraud
- K2: Urdu UI
- N1–N2: mobile
- D2: live scheme catalogue

---

## Sources

Tax
- [T1] PwC Worldwide Tax Summaries, Pakistan: corporate deductions. 25% initial allowance (excludes buildings, road transport vehicles not plying for hire, furniture, plant previously used in Pakistan); rates of 10% buildings, 15% plant/machinery/vehicles/furniture, 30% computers; Rs 7.5m cost cap on passenger vehicles; lease-rental rules. https://taxsummaries.pwc.com/pakistan/corporate/deductions
- [T2] PwC, Pakistan: taxes on corporate income. 29% companies, 20% small companies, super tax tiers, minimum tax on turnover 1.25%, export withholding treated as minimum tax (not final) after the Finance Act 2024. https://taxsummaries.pwc.com/Pakistan/Corporate/Taxes-on-corporate-income. Also PIDE, "When Revenuecracy Out-Taxes Export Growth" (2026): https://pide.org.pk/research/when-revenuecracy-out-taxes-export-growth/. Finance Act 2026 (enacted 26 Jun 2026): https://regfollower.com/pakistan-enacts-finance-act-2026-with-income-tax-reforms-digital-compliance-measures/
- [R-WHT] Section 153 withholding rates, active vs non-active taxpayers (secondary source): https://pkrevenue.com/withholding-tax-card-for-goods-and-services-in-2025-26-fbr/ ; https://pkrevenue.com/fbr-updates-withholding-tax-rates-for-goods-and-services-for-ty2027/

Rates and SBP schemes
- [R-PR] Policy rate set at 11.5% from 28 Apr 2026: https://www.sbp.org.pk/dmmd/2026/C2.htm ; https://profit.pakistantoday.com.pk/2026/04/28/sbp-sets-overnight-reverse-repo-at-12-50-repo-at-10-50/ . Held on 14 Sep 2026: https://arynews.tv/sbp-retains-policy-rate-at-11-5-percent . Held on 27 Jul 2026: https://propakistani.pk/2026/07/27/sbp-keeps-interest-rate-unchanged-to-start-fy27/ . 10.5% cut in Dec 2025, after 1,150 bps of easing from 22%: https://english.aaj.tv/news/amp/330449487 . KIBOR (3M 11.99%, 6M 12.41% offer on 9 Oct 2026): https://www.sbp.org.pk/ecodata/sir.pdf
- [R-LTFF] LTFF eligibility (≥50% exports or US$5m) and tenors (3, 5 or 10 years, up to 2 years' grace): https://www.bankalhabib.com/long-term-financing-facility-ltff-for-plant-and-machinery ; https://www.sbp.org.pk/MFD/2018/Instructions-LTFF.pdf . Markup linked to the policy rate: https://www.sbp.org.pk/Incen/Export-2.asp ; https://www.sbp.org.pk/smefd/circulars/2022/C11.htm (the 8.5% = 11.5% − 3% is the app's own arithmetic; banks must confirm)
- [R-EFS] Export Finance Scheme end-user rate cut to 5.5% from 11 Feb 2026 (SBP rates sheet): https://www.sbp.org.pk/assets/document/sir.pdf
- [R-RE] SBP renewable-energy financing scheme discontinued from 1 Jul 2024: https://archive.sbp.org.pk/Incen-others/index.asp ; https://propakistani.pk/2023/07/10/govt-halts-financing-scheme-for-renewable-energy/
- [R-SME] Refinance for Modernization of SMEs and SME working-capital refinance discontinued from 1 Jul 2025: https://archive.sbp.org.pk/Incen-others/index.asp . SAAF: https://archive.sbp.org.pk/Incen-others/saaf.asp
- [R-PMYB] PM Youth Business & Agriculture Loan Scheme tiers (0% / 5% / 7%, up to Rs 7.5m): https://www.sbp.org.pk/incen-others/PMYBALS.asp (validity after 30 Jun 2026 unconfirmed: https://mcb.com.pk/business/agriculture-financing/agriculture-products/prime-minister-youth-business-and-agriculture-loan-schemeex-pmkjyes-now-revised-as-pmybals)
- [R-GREEN] Bank Alfalah Green Energy SME solar (KIBOR + spread, up to 5 years, 3 months' grace): https://www.bankalfalah.com/business-banking/sme-loans/alfalah-green-energy

Islamic finance
- [R-ISL] SBP Islamic Banking Bulletin, Dec 2025: 38.1% share of banking financing, 22.9% of assets. https://www.sbp.org.pk/assets/document/publications/Islamic_Banking_Bulletin_December_2025.pdf
- [R-IJ] Meezan Car Ijarah (1–5 years, at least 30% security deposit): https://meezanbank.com/?p=126390 . BOK machinery Ijarah, KIBOR-linked: https://bok.com.pk/islamic/islamic-banking/business-banking/sme-banking/term-financing

Seasonality, energy and costs
- [S20] Ramadan 2027 expected about 8 Feb, Eid ul Fitr about 9–10 Mar, Eid ul Adha about 16–17 May 2027 (estimates): https://propakistani.pk/2026/08/22/uae-reveals-expected-dates-for-ramadan-and-eids-in-2027/ ; https://blog.wego.com/ramadan-2027/
- [R-NM] Net-metering buyback cut from Rs 27 to Rs 10 a unit (Mar 2025): https://profit.pakistantoday.com.pk/?p=191075 . Move to net billing (2026): https://profit.pakistantoday.com.pk/2026/01/31/pakistan-plans-shift-from-net-metering-to-net-billing-for-rooftop-solar-users
- [R-SCH] Rawalpindi schools closed 28 May–14 Aug 2025 and barred from collecting advance fees: https://www.result.pk/educom/private-schools-prohibited-from-collecting-advance-fees-49725.htm
- [R-COST] Suzuki Every launch price Rs 27.49–27.99 lakh (Bolan discontinued): https://www.pakwheels.com/blog/new-suzuki-every-official-price-announced/amp
- Sialkot football exports (about 48m balls, $221.8m, Jul 2025–Apr 2026): https://www.app.com.pk/?p=1224169

Fraud, payments, channels
- [R-RAAST] Raast credits must land within 20 seconds: https://www.sbp.org.pk/circulars/disd-circular-no-1-of-2022 . NCERT warning on WhatsApp account takeover (Jan 2026): https://propakistani.pk/2026/01/13/alert-your-whatsapp-can-easily-be-hacked-right-now-ncert-warning/amp/ . Fake-vendor invoice case (Dec 2025): https://propakistani.pk/2025/12/31/fraud-fake-invoices-top-executives-named-in-750000-scam-at-private-it-firm/amp/
- [R-POS] FBR POS integration (1,093 restaurants, 30 Jun 2026): https://www.fbr.gov.pk/pos-integrated-retailers/163085/163089 . E-invoicing mandatory for sales-tax-registered persons (SRO 1852(I)/2025): https://www.comarch.com/trade-and-services/data-management/legal-regulation-changes/pakistan-extends-e-invoicing-implementation-schedule/
- [R-WA] WhatsApp Business per-message pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- [R-RU] Roman Urdu as the dominant way of writing messages: https://distantreader.org/stacks/journals/sjcms/sjcms-397.pdf
- [R-OB] BankIslami aik Connect open-banking APIs (Aug 2026): https://propakistani.pk/2026/08/29/aik-by-bankislami-launches-pakistans-first-ever-shariah-compliant-open-banking-platform-aik-connect/

*Not sourced, so treated as simulation assumptions:* business sizes, the prices of injection moulding machines, embroidery machines and fit-outs, AOP marginal rates, and the exact bank solar rates (third-party figures only).
