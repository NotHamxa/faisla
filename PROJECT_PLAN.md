# Faisla — Project Plan

Team CodeStorm · AICON'26 Build With AI · Domain: **Financial Operations**
Technical details: [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md)

## Event

| | |
| --- | --- |
| Team | CodeStorm (4 members) |
| Domain | Financial Operations: AI for payments, fraud detection, credit and risk assessment, accounting automation, financial planning |
| Required pitch flow | Problem → Data/Input → AI Component → Solution → Impact |
| Deliverable | Working MVP powered by AI |
| Presentation | 11 Oct 2026, 11:20–11:25 AM (5 minutes), SEECS CR-01 |
| Arrive | All four members at SEECS CR-01 by 11:15; submission checklist ticked by 11:00 |

## Files in this folder

| File | What |
| --- | --- |
| `TECHNICAL_SPEC.md` | Architecture, finance engine, APIs, schema, prompts, tests |
| `PROJECT_PLAN.md` | This file: decisions, backlog, roles, schedule, pitch, risks |
| `reference/Faisla-Build-Plan-original.docx` | The team's original build plan |
| `reference/Faisla-Build-Plan-revised.docx` | Build plan with the finance fixes and reviews feature applied |
| `reference/finance_reference.py` | Reference calculator that produced every number in the spec (`python finance_reference.py`) |

---

## 1. Decisions

| Decision | Why |
| --- | --- |
| Keep Faisla; don't switch idea | Fits Financial Operations (financial planning at the core, plus credit/risk, accounting automation, payments); plan is detailed and numbers are checked; switching the day before costs more than it gains |
| Lead the pitch with the money decision, not procurement | Avoids "this is supply chain, not finance"; supplier search is framed as how Faisla gathers data |
| AI reads, code calculates, owner confirms | Answers both "is the AI meaningful?" and "can we trust the numbers?" |
| Finance engine and comparison table are the part that cannot fail | The finance-domain judge carries most of the score |
| Reviews are SHOULD, built from cached results | Adds value ("is the cheapest option safe?") without risking the demo path |
| Freeze rule | Once the full path works on the deployed link, only bug fixes and polish |

## 2. Done so far

- Read and summarised the build plan.
- Reviewed it for adequacy; verdict: strong for a finance track, main risks are scope and a few finance gaps.
- Recomputed every demo number with a reference script; pre-tax figures in the original doc were correct.
- Produced `reference/Faisla-Build-Plan-revised.docx` with these fixes:
  1. **Depreciation included**: the old claim "same under every option" was wrong (Rs 60 lakh vs 55.2 vs 53.6 lakh bases). Now 25% initial allowance + 15% reducing balance, 10-year life.
  2. **Consistent after-tax view**: tax savings at year end, discounted at the after-tax rate 10.65%. New after-tax column in the results table. LTFF still wins (Rs 40.14 lakh; Rs 4.7 lakh below the "0%" plan).
  3. **Runway includes the new monthly payment**: LTFF 2.59 (was 2.70), installments 2.50 (was 2.86); defined as a floor with no sales income.
  4. **Installment timing is an input**: demo quote says first installment one month after delivery; if due on delivery the hidden rate is 20.3%, not 16.9%.
  5. **Assumptions card**: fees, insurance, collateral, LTFF approval time and eligibility.
  6. **15% discount rate justified** (≈ bank rate); LTFF beats cash at any discount rate above 8.8%.
  7. Unit tests, demo script, judge answers, glossary and "to verify" list updated to match.
  8. **Reviews feature** added everywhere: how-it-works, AI table, `/api/reviews`, `reviews` table, prompt 6, cached demo reviews, Person C tasks, schedule, risk row.
  9. Time fallback: use a fixed supplier list before cutting any finance feature.

## 3. Backlog

### MUST (demo path)

| # | Item | Owner | Done when |
| --- | --- | --- | --- |
| M1 | Company profile form | A | Saves exporter flag, cash, fixed costs, tax rate, discount rate |
| M2 | Quotation upload + AI extraction + confirm screen | A | Demo quotation photo fills every field; fields editable; arithmetic check flags mismatches |
| M3 | Market check card | C | Quoted price vs benchmark median and web prices, links, "% above market" |
| M4 | Supplier finder + RFQ email | C | 2–3 suppliers with contacts; "Send" delivers to a test inbox |
| M5 | Reply reader | C | Reply in test inbox → price extracted → new offer row |
| M6 | Finance engine + unit tests | B | All tests in spec §4.6 pass |
| M7 | Financing comparison table | B | Five rows match spec §4.5; "show calculation"; Assumptions card visible |
| M8 | Decision memo + bank email | D | Memo from code's numbers passes number check; "Request term sheet" sends email |
| M9 | Deployed link | A | Opens on phone and laptop in incognito |

### SHOULD (only after the full path works)

| # | Item | Owner | Done when |
| --- | --- | --- | --- |
| S1 | After-tax column + stress-test slider | B | Live updates match unit tests |
| S2 | Reputation card (reviews of supplier and product) | C | Cached reviews show good / mixed / red flags with links; red flags in memo risks |
| S3 | Installment reminders | D | Payment dates listed; reminder emails scheduled |
| S4 | PDF export of memo | D | Downloads cleanly |

### PROPOSED (suggested, not yet agreed — decide as a team)

| # | Item | Owner | Effort | Why |
| --- | --- | --- | --- | --- |
| P1 | **Payment-fraud check** (account-change emails, IBAN mismatch, domain mismatch, urgency language) | C | 1–2 h | Hits "fraud detection" in the module list; strong live demo beat; spec §8 |
| P2 | **Bank-ready loan pack** (memo + repayment schedule + runway + optional DSCR) | D | ~1 h | Hits "credit and risk assessment" from the lender's side; spec §9 |
| P3 | **Slides follow the organisers' flow** (one slide per stage) | D | 30 min | Judges score against that flow; see §5 below |
| P4 | Investment check: payback and NPV from "expected extra monthly profit" | B | ~1 h | Answers "should you buy at all?"; lower priority; spec §10 |

If P1/P2 are accepted, they slot in as SHOULD items after S1–S2 and never before the full demo path works.

### ROADMAP (slide only)

Islamic financing (Ijarah, Diminishing Musharakah), leasing, bulk stock purchases, vehicles, solar savings model, multi-user approvals, WhatsApp intake.

---

## 4. Roles and schedule

| Role | Owns |
| --- | --- |
| A: Capture & app shell | Next.js app, Vercel deploy, Supabase, profile, upload, extraction, confirm screen |
| B: Finance engine | `lib/finance.ts`, unit tests, comparison table, "show calculation", after-tax, stress test (P4 if accepted) |
| C: Market & email | Search API, cleaning and caching, reviews and reputation card, supplier finder, RFQ send, reply reader, bank email (P1 if accepted) |
| D: Data, memo & pitch | Demo data, quotation printout, memo + number check, UI polish, slides, script, backup video, journey video (P2, P3 if accepted) |

| Hours | A | B | C | D |
| --- | --- | --- | --- | --- |
| 0–2 | App skeleton, empty deploy, Supabase tables | Unit tests from spec §4.6 first | Test search API on 2 models; choose one | Company profile, financing options, start benchmark |
| 2–5 | Upload + extraction + confirm | All finance functions pass | Cleaning + caching + market card; cache demo reviews | Print/photograph quotation; finish benchmark; fake fraud reply (if P1) |
| 5–8 | Wire confirm → decide → table | Table UI + "show calculation" | Supplier finder, RFQ send, reply reader | Memo prompt + number check; slides draft (P3 flow) |
| 8–10 | Full path end to end, deployed | Fix numbers that differ from tests | Bank email; retry/timeout handling | First timed rehearsal |
| 10–12 | Bug fixes from rehearsal | After-tax column, stress slider (S1) | Reputation card (S2); fraud check (P1 if accepted); bug fixes | Backup video; README; loan pack (P2 if accepted) |
| 12+ | Polish only | Polish only | Polish only | Rehearse ×3; journey video |

Rule of thumb from the last hackathon: about a third of the time building, two-thirds proving every demo path works.

---

## 5. Pitch

### Slides (5 max, following the organisers' flow) — P3

1. **Problem**: SMEs decide big purchases blind; four mistakes (hidden interest, missed LTFF, ignored tax, cash crunch); 82% of Pakistani SMEs report cash-flow shortages; $5.7T SME finance gap.
2. **Data/Input**: quotation photo, supplier emails (Roman Urdu), web prices and reviews, company cash and costs, SBP rates.
3. **AI Component**: AI reads, code calculates, owner confirms (two-column diagram: AI side vs code side).
4. **Solution**: the comparison table + memo (screenshot), with the three moments: hidden 17%, LTFF 8.5%, live email reply.
5. **Impact + roadmap**: Rs 5.8 lakh saved (4.7 after tax), cash kept; SBP AI sandbox fit; roadmap plug-ins; live link.

### 5-minute script (updated lines)

| Time | Speaker | Beat |
| --- | --- | --- |
| 0:00–0:35 | D | Hook: Hamza, sixty lakh, "0% markup", no finance team |
| 0:35–1:20 | A | Photo → AI reads → owner confirms → market check: ~10% above market |
| 1:20–2:15 | C | Finds two suppliers, **checks what other buyers say about them**, sends RFQs; live Roman Urdu reply → new row (fraud flag beat here if P1) |
| 2:15–3:30 | B | Code does the maths: hidden ~17%; LTFF ~8.5% vs ~15%; cash pay leaves ~1 month of salaries. **Saves ~5.8 lakh, 4.7 lakh even after tax, and leaves two and a half months of costs in the bank** |
| 3:30–4:10 | A | AI reads, code decides, owner confirms; memo number check; "Request term sheet" |
| 4:10–5:00 | D | Impact and close; live link |

If a step fails live: "here's the recording", play the backup video from that point.

### Judge questions

| Question | Answer |
| --- | --- |
| Can't ChatGPT do this? | It can calculate if given every number. Faisla collects the numbers: reads the quotation, finds suppliers, emails them, reads replies, knows the company's cash, applies Pakistani tax and SBP rules in tested code. |
| Where exactly is the AI? | Reading quotations, replies and reviews; cleaning web prices; finding suppliers; writing emails and the memo. Not the maths, deliberately. |
| What if the AI misreads the quotation? | Owner confirms every field; code checks qty × price against the printed total. |
| How do we know 17% is right? | "Show calculation": standard IRR. Timing is an input; due on delivery it's 20.3%. |
| Is 8.5% for LTFF real? | SBP sets LTFF at policy rate − 3%; policy rate 11.5% since 14 Sept 2026; banks confirm, hence the term-sheet email. |
| Did you include tax? | Yes: markup and depreciation (25% initial allowance, then 15%), on what each option actually pays, discounted at 10.65% after tax. LTFF still wins. |
| Why a 15% discount rate? | About the company's bank borrowing rate (KIBOR + 3% ≈ 14.8%); editable; LTFF beats cash above 8.8%. |
| What about bank fees and collateral? | On the Assumptions card; fee field editable; the term-sheet email asks the bank. |
| Is the benchmark data real? | Benchmark and supplier reviews are simulated and labelled; web prices and the supplier reply are real inputs. |
| Is this really Financial Operations? | It's financial planning and credit/risk for SMEs: financing choice, true cost of credit, tax, liquidity (plus fraud check if P1). |
| How do you handle payment fraud? (if P1) | Code compares bank details across quotation and replies, checks IBAN validity and sender domain; AI flags account-change language; payment is blocked until the owner confirms by phone. |
| Who pays for this? | SMEs on a monthly plan; banks (clean loan applications); suppliers listed in comparisons. |
| Is this financial advice? | It compares options for a business decision; the owner decides; numbers and sources are shown. |
| What did you build here? | Today's commit history on GitHub. |

---

## 6. Submission checklist (tick before 11:00 on 11 Oct)

- [ ] GitHub repo public (or access given to organisers), today's commits visible
- [ ] README: problem, how AI is used, architecture, finance formulas, synthetic-data disclosure, third-party APIs and libraries
- [ ] Deployed link opens on a phone and a laptop in incognito
- [ ] Demo runs on the team laptop with cached search results and reviews
- [ ] Backup video of the full demo saved locally
- [ ] Slides (5 max), following Problem → Data/Input → AI Component → Solution → Impact, live link on the last slide
- [ ] Phone hotspot ready
- [ ] Optional screen recording uploaded
- [ ] Optional 3-minute "Document Your Journey" video
- [ ] All four members at SEECS CR-01 by 11:15

## 7. Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| A finance number is wrong | Unit tests first; "show calculation" on every row; check rates with a finance student or bank |
| Search API returns junk for Pakistani prices | Cached real results; switch machine model |
| Vision misreads the quotation | Tested printout; confirm screen fixes it live (a feature) |
| Email reply is slow | Poll every 10 s; use the rehearsal reply already in the inbox |
| Few or no online reviews for Pakistani suppliers | Show "not enough reviews"; cached reviews for the demo |
| Venue Wi-Fi fails | Phone hotspot, then backup video |
| Running out of time | Cut SHOULD/PROPOSED first; then use a fixed supplier list instead of the live finder; never cut a finance feature, the backup video or the rehearsal |
| Judge says "this is just a calculator" | Point to reading the quotation, finding suppliers, checking reviews, emailing and reading replies (and fraud check if P1) |
| Judge says "this is procurement, not finance" | Lead with the financing decision; map features to the module list (spec §1) |

## 8. Verify before the demo

- [ ] Current KIBOR fixing
- [ ] Exact LTFF rate a bank quotes today; LTFF eligibility and approval time
- [ ] 29% tax rate for the company type
- [ ] 25% initial allowance and 15% depreciation for this machine class, both in year 1
- [ ] 10-year machine life assumption
