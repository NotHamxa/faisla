# Faisla: judge preparation

Everything a teammate needs to explain Faisla end to end and handle any question. Every number below comes from the real finance engine (`src/lib/finance.ts`). Re-run the scenario table with `npx vitest run -c vitest.live.config.ts scripts/scenarios.live.ts`; results land in `scripts/bench-results.txt`.

Live: https://faisla-xi.vercel.app · login `demo@faisla.pk` / `faisla2026` · repo https://github.com/NotHamxa/faisla

---

## 1. The 30-second mental model

> **AI reads, code calculates, the owner confirms.**

- **AI** turns messy inputs into structured data: quotation photos, Roman Urdu supplier replies, web listings, reviews and plain-language needs. It also writes text: price-request emails and the decision memo.
- **Code** does every rupee: hidden cost of "0%" plans, monthly installments, true cost in today's money, tax, cash left, the recommendation and the fraud rules. No number on screen is computed by an LLM.
- **The owner** confirms every extracted field, can override any choice, and the bank and supplier confirm rates and accounts.

**The demo:** Hamza Garments (Faisalabad exporter, Rs 1 crore cash, Rs 35 lakh a month fixed costs) wants 80 × Jack F5 sewing machines.
- Supplier A quotes Rs 60 lakh with a "0% markup" plan of 12 × Rs 5 lakh, or Rs 55.2 lakh cash (8% discount).
- Faisla shows the "0%" plan really costs 16.9% a year.
- It finds Supplier B at Rs 67,000 a machine (Rs 53.6 lakh) through a Roman Urdu reply.
- It recommends SBP Islamic LTFF at 8.5%: Rs 5,79,103 cheaper than the quoted plan (Rs 4,73,603 after tax), and it keeps 2.59 months of costs in the bank (paying cash would leave 1.33).
- It blocks a fake "our bank account changed" email.

---

## 2. The tech, layer by layer

### 2.1 Stack and hosting
| Layer | What we use | Why |
| --- | --- | --- |
| Web app | Next.js 16 (App Router), React 19, TypeScript | One codebase for pages and API routes; type safety on money code |
| UI | Tailwind v4 + shadcn/ui (Base UI), our own "ledger" design system; light/dark | Fast to build; accessible components |
| Database | MongoDB Atlas | Flexible documents: one decision holds its quotation, offers, emails, comparison and memo |
| AI | OpenAI Responses API with strict structured outputs (JSON schemas via Zod) | The model must return valid, typed data, or we fall back |
| Web search | Tavily (advanced search, Pakistan-focused; extract API for pasted links) | Search built for AI agents; returns page text, not just links |
| Email | Gmail SMTP (send) + IMAP (read), via nodemailer / imapflow / mailparser | Simple and real; only to team test inboxes |
| Hosting | Vercel (production), GitHub (public repo) | Free, fast deploys |
| Tests | Vitest: 194 automated tests; Playwright browser tests for every flow | Every spec number is pinned by a test |

### 2.2 How a request flows
```
Browser ──► Next.js page (server-checks your session) ──► client workspace (autosaves every change)
   │
   └──► /api/* route ──► checks session against MongoDB ──► AI (OpenAI) / search (Tavily) / email (Gmail)
                                                         └──► finance.ts (pure code) ──► result to the screen
```

### 2.3 Login and security
- **Passwords:** hashed with scrypt (Node's built-in), never stored in plain text.
- **Sessions:** a random token in an httpOnly cookie (the browser's JavaScript can't read it). The database stores only its SHA-256 hash, and sessions expire after 7 days.
- **Two locks:**
  1. A proxy sends signed-out visitors to /login.
  2. Every API route verifies the session against the database. A forged cookie gets 401, so nobody can spend our AI credit or send emails.
- **The paste-a-link reader** only accepts http/https and blocks localhost and private network addresses (SSRF protection, re-checked on redirects).
- **Secrets** (API keys, database URL) live only in Vercel environment variables and a git-ignored local file. The git history was scanned: no keys.

### 2.4 Data model (MongoDB)
- **users:** email, name, password hash, company.
- **sessions:** token hash, user, expiry.
- **companies:** profile (cash, fixed costs, tax rate, discount rate, exporter flag), plus settings (Shariah-only or both, pay in full when affordable) and financing options (rates, tenors, fees).
- **decisions:** one per purchase. It holds the quotation, offers, market check, reviews, suppliers, emails, the comparison, the owner's choice, the memo and phone confirmations of bank accounts.
- **Autosave:** the workspace saves every change about 0.6 s after you stop typing, so a refresh never loses work.

### 2.5 The AI, task by task, and what code checks afterwards
Each task uses the cheapest model that was accurate on our real data. We benchmarked 7 OpenAI models on our own quotation photo, Roman Urdu replies and memo (`scripts/models.live.ts`).

| AI task | Model (tier) | What code checks afterwards |
| --- | --- | --- |
| Read a quotation photo or PDF into fields | gpt-6-luna (vision) | Arithmetic: qty × unit price vs printed totals; installment total vs cash price; IBAN checksum. The owner confirms every field. |
| Read supplier replies (incl. Roman Urdu: "67 hazar", "1 saal") | gpt-4.1-nano (fast) | A deterministic Roman Urdu/lakh parser cross-checks the price; the AI's price must be written in the email |
| Turn a plain-language need into requirements + searches | gpt-4.1-nano (fast) | Budget only counts if the owner actually wrote it |
| Read web listings (prices, specs, condition) | gpt-6-luna (read) | Price must appear in the page text; spec keywords must match; used, search and category pages dropped; outlier rule; at least 3 prices for a median |
| Read reviews | gpt-4.1-nano (fast) | Scoring rules in code (red / mixed / good / not enough); a review must name the store's site |
| Find dealers for non-demo items | gpt-4.1-nano | Emails always go to our test inbox |
| Write price-request emails | gpt-6-luna (write) | Template fallback |
| Write the decision memo | gpt-6-luna (write) | **Number check:** every number in the memo must match the calculation, or it is regenerated (up to 2 retries), then replaced by a template. Fraud warnings are forced in if missing. |
| Flag "account changed / pay today" wording | gpt-4.1-nano (inside reply reading) | Regex rules decide; the AI only adds a quoted sentence |

- **Cost:** about $0.002 per full decision, so $5 covers about 2,500 decisions.
- **Fallbacks:** if the AI key, the network or the model fails, every route falls back to cached demo data or a template. The demo can't break.

### 2.6 The search pipeline ("I know what I need")
1. The AI turns the sentence into requirements with keyword alternatives. Example: i9 → "i9", "core i9", "ultra 9"; RTX 4050 → "rtx 4050", "4050".
2. Three searches go to new-item retailers in Pakistan, excluding OLX, Facebook and PakWheels unless you ask for used.
3. Only single product pages are kept, never search or category pages.
4. **Code checks each listing:**
   - the specs are in its text;
   - the price is written on the page;
   - it is new;
   - at most 2 listings per store.
5. Nothing passes? It says "No new listings match …", never a wrong result.
6. **Paste a link** runs the same checks on a page you found yourself, either on "Your need" or "Other offers".

### 2.7 Payment-fraud check (`src/lib/fraud.ts`, all code)
| Signal | Level |
| --- | --- |
| IBAN differs from the one on file (taken from the quotation) | High |
| IBAN fails its checksum (ISO 13616 mod-97) | High |
| "Account changed", "pay today", "naya account" wording | Medium |
| Account title doesn't match the supplier | Medium |
| Sent from free webmail (gmail.com) instead of the company domain | Medium |

High risk shows a red warning on every step and blocks "Ask the bank for an offer" until the owner ticks "I confirmed this account by phone on a number I already had". It also appears in the memo's risks and on the dashboard.

---

## 3. The finance engine: how each number is made

Demo inputs: 15% a year discount rate (the business's cost of money, about KIBOR + 3%); 29% tax; payments monthly, in arrears.

| Number | Meaning | How it is computed |
| --- | --- | --- |
| **16.9% a year** | Hidden cost of the "0%" plan | Find the monthly rate r where 55,20,000 (cash price) = Σ 5,00,000 / (1+r)^t for t = 1…12 → r = 1.3067% a month → (1+r)^12 − 1 = **16.86%**. If the first installment is due on delivery: **20.32%**. |
| **Rs 1,52,282** | Islamic LTFF monthly installment | Financed amount 48,24,000 (after the 10% contribution of 5,36,000), 8.5% ÷ 12 a month, 36 months: P·i·(1+i)^n / ((1+i)^n − 1) |
| **Rs 49,87,935** | True cost before tax | Present value: every payment brought back to today at 15% a year (1.1715% a month) |
| **Rs 40,13,687** | True cost after tax | Same, minus tax savings (29% of deductible profit + depreciation), received at each year end, discounted at 10.65% (= 15% × (1 − 29%)) |
| **Depreciation** | Tax deduction for the machines | 25% initial allowance in year 1, then 15% a year on the reducing balance, written off by year 10 |
| **Ijarah after tax 41,90,272** | Why Ijarah beats Diminishing Musharakah at the same rate | Ijarah rentals are fully deductible as paid (no depreciation during the lease), so tax savings come sooner |
| **2.59 months** | Cash left | (cash − upfront) ÷ (fixed costs + new monthly payment) = (1,00,00,000 − 5,36,000) ÷ (35,00,000 + 1,52,282). Counts no sales income, so it is a floor. Today: 1 crore ÷ 35 lakh = 2.86. |
| **8.84%** | Break-even rate | Islamic LTFF beats paying cash whenever your money is worth more than 8.84% a year. That is 8.5% compounded monthly. |
| **Rs 5,79,103** saved | vs the quoted "0%" plan | 55,67,038 − 49,87,935, before tax (4,73,603 after tax) |

**Where the Rs 5.8 lakh comes from** (before tax):

| Step | Saving |
| --- | --- |
| A's "0%" plan 55,67,038 → A cash 55,20,000 | Rs 0.47 lakh |
| A cash → B cash 53,60,000 (Supplier B is cheaper) | Rs 1.6 lakh |
| B cash → B with Islamic LTFF 49,87,935 | Rs 3.72 lakh |

### 3.1 The recommendation rule (the decision tree)
1. Build every way to pay:
   - for each offer: cash, plus the supplier's plan if it has one;
   - financing on the **cheapest cash offer**: Islamic LTFF only if the company is an exporter; Ijarah and Diminishing Musharakah always; conventional only if the preference is "both".
2. Only Shariah-compliant rows can be recommended. Conventional rows say "comparison only".
3. Keep rows that leave **at least 2 months** of fixed costs ("safe").
4. If "Pay in full when we can afford it" is on and a cash row is safe, recommend the cheapest safe cash row.
5. Otherwise recommend the **lowest true cost after tax** among safe rows. If none is safe, take the lowest true cost overall and say "every option leaves little cash".
6. The owner can **choose any row** instead. Faisla then shows how much more it costs, and the memo, bank request and dashboard follow the choice.

---

## 4. Every important decision and what it changes (real engine results)

| Scenario | Recommended | True cost after tax | Cash left | Saving vs quote (before / after tax) | What to say |
| --- | --- | --- | --- | --- | --- |
| **Base demo** (exporter, Shariah-only) | Islamic LTFF 8.5% | 40,13,687 | 2.59 | 5,79,103 / 4,73,603 | The headline |
| **Not an exporter** | Ijarah 14.8% | 41,90,272 | 2.58 | 1,56,026 / 2,97,018 | No LTFF without exports; Ijarah wins on tax timing |
| **Preference: both** | Islamic LTFF (conventional shown, labelled) | 40,13,687 | 2.59 | same | Conventional LTFF costs the same, so going Islamic costs nothing here |
| **Pay in full ON, Rs 1 crore cash** | Islamic LTFF (unchanged) | 40,13,687 | 2.59 | same | Cash would leave 1.33 months, below the 2-month line, so not affordable |
| **Pay in full ON, Rs 2 crore cash** | B cash | 42,92,409 | 4.18 | 2,07,038 / 1,94,881 | Faisla still says LTFF would be Rs 2,78,722 cheaper |
| **Pay in full OFF, Rs 2 crore cash** | Islamic LTFF | 40,13,687 | 5.33 | 5,79,103 / 4,73,603 | Cheaper in today's money, and safe |
| **Only Rs 50 lakh cash** | Islamic LTFF | 40,13,687 | **1.22** | same | No option is safe; screen says "every option leaves little cash". Buying cash would go negative. |
| **First installment on delivery** | Islamic LTFF | 40,13,687 | 2.59 | 6,44,321 / 5,21,727 | The "0%" plan becomes **20.3%** a year |
| **Discount rate 8%** | Islamic LTFF | 41,51,752 | 2.59 | 3,40,813 / 2,73,295 | B cash is cheaper in today's money (41,10,405) but leaves 1.33 months, so the safety rule picks LTFF |
| **Discount rate 20%** | Islamic LTFF | 39,08,915 | 2.59 | 7,16,661 / 5,94,370 | The more your money is worth, the more paying later helps |
| **Tax rate 0%** | Islamic LTFF | 49,87,935 | 2.59 | 5,79,103 / 5,79,103 | No tax effect; Ijarah = Diminishing Musharakah |
| **KIBOR +2%** | Islamic LTFF | 40,13,687 | 2.59 | same | Ijarah/DM rise to 16.8%; LTFF follows the SBP policy rate, so it doesn't move |
| **KIBOR +4%** | Islamic LTFF | 40,13,687 | 2.59 | same | Same; recommendation is robust |
| **2% processing fee** | Islamic LTFF | 40,84,881 | 2.56 | 4,82,623 / 4,02,409 | Fees paid upfront; break-even rises to 10.34% |
| **Only Supplier A** (no B) | A + Islamic LTFF | 41,33,499 | 2.58 | 4,30,210 / 3,53,791 | Even without a better supplier, financing beats the "0%" plan |
| **Only A, not exporter** | A + Ijarah | 43,15,355 | 2.57 | **−5,496** / 1,71,935 | Before tax Ijarah is slightly dearer than the plan; after tax it's cheaper. Tax matters. |

### 4.1 Each step in the app and what it affects
| Step / setting | Affects the money? | Effect |
| --- | --- | --- |
| **Start: quotation or "I know what I need"** | Yes: sets Offer A | Either the AI reads the quote or you pick web listings |
| Quotation fields: price, qty, cash discount, installments, first-on-delivery | **Yes** | Directly change Offer A's rows (e.g. on delivery → 20.3%) |
| Bank details on the quote | No (fraud only) | Become "account on file" for the fraud check |
| **Price check** (market, real listings) | No | Information: "about 9% above the market" |
| **Reputation** (reviews) | No | Shown, and red or mixed flags go into the memo's risks |
| **Other offers** (replies, paste, link) | **Yes** | Each new offer adds rows; financing is built on the cheapest cash offer |
| **Fraud email** | No money; blocks action | Bank request blocked until phone confirmation; memo risk; dashboard alert |
| **Compare: stress slider** | Shows "what if" | Moves only KIBOR-linked rows (Ijarah, DM, conventional loan) |
| **Compare: choose a row** | Yes, for actions | Memo, bank request, dashboard use your choice; shows the extra cost |
| Settings: exporter, cash, fixed costs, tax, discount rate | **Yes** | See the scenario table |
| Settings: Shariah-only / both | Visibility | Conventional rows appear only with "both", never recommended |
| Settings: pay in full when affordable | **Yes** | Cash recommended when it leaves 2+ months |
| Financing page: rates, tenor, contribution, fees | **Yes** | Recalculate the rows |
| **Decide: memo** | No | Written from the calculation; every number checked |
| **Ask the bank for an offer** | No | Email to the Islamic bank's SME desk for the chosen financing (or "no bank needed" for cash) |

---

## 5. Simulated judging: questions and answers

Judges score AI Integration Depth, Problem-Solving, Demo & Presentation, Creativity & SDG Impact, and Industrial Impact. The finance judge counts 85%.

### AI integration depth
1. **"Where exactly is the AI? Isn't this a calculator with ChatGPT bolted on?"**
   The AI does the work a person would otherwise do by hand: reading a quotation photo, reading Roman Urdu supplier replies, turning "i9 gaming PC with RTX 4050" into checkable requirements, reading web listings and reviews, and writing emails and the memo. It deliberately does *not* do the maths. Every AI output is then checked by code.
2. **"Why not let the AI do the calculations?"**
   LLMs make arithmetic mistakes and can't be audited. A wrong rupee in a financing decision costs real money. Code is tested (194 tests) and every figure has "show calculation".
3. **"What if the AI misreads the quotation?"**
   The owner confirms every field on the confirm screen. Code checks qty × price against the printed total, flags installment totals above the cash price, and validates the IBAN checksum.
4. **"How do you stop hallucinated prices?"**
   A price is only accepted if that exact number appears in the source text (email or web page). Otherwise it's dropped, or the owner enters it.
5. **"How do you stop the memo inventing numbers?"**
   Code extracts every number from the AI-written memo and compares it with the calculation. If anything doesn't match it regenerates (up to twice), then falls back to a template.
6. **"Which models, and why?"**
   gpt-6-luna for vision, reading and writing; gpt-4.1-nano for fast extraction. We benchmarked 7 models on our own data: accuracy first, then cost. gpt-6-luna read all 12 quotation fields correctly; some bigger models missed the installment.
7. **"What does it cost to run?"**
   About $0.002 per full decision.
8. **"What happens if OpenAI is down?"**
   Every AI step falls back to cached data or a template, and the owner can type values. The finance engine needs no AI at all.
9. **"What data do you send to the AI?"**
   Only the document or text being read. No passwords, no bank credentials; the IBAN check is local code.

### Problem and finance (the domain judge)
10. **"Is the 16.9% real? How did you get it?"**
    It's the internal rate of return of the plan: the monthly rate at which 12 payments of Rs 5 lakh are worth the Rs 55.2 lakh cash price, annualised. "Show calculation" on that row proves it. If the first payment is due on delivery, it's 20.3%.
11. **"Isn't a '0% markup' plan permissible? Why call it hidden cost?"**
    We don't call it interest. A deferred-price sale (bay' muajjal) is permissible when the price is fixed upfront. We only show its effective yearly cost, so the owner compares fairly with paying cash.
12. **"Is 8.5% for Islamic LTFF real?"**
    SBP's formula is policy rate minus 3%. The policy rate is 11.5% (set 28 April 2026, held 14 September), so 8.5% is our arithmetic. The bank confirms the exact rate, which is why Faisla drafts a request for an offer.
13. **"Why a 15% discount rate?"**
    It's the business's cost of money, roughly KIBOR + 3%, and it's editable in Settings. At 8% Faisla still picks LTFF, because cash would leave only 1.33 months. LTFF beats cash above 8.84%.
14. **"Why recommend financing when he has the money?"**
    Two reasons:
    - Paying Rs 53.6 lakh now leaves 1.33 months of salaries and rent, below our 2-month safety line.
    - At 8.5%, financing costs less in today's money than paying now.

    If the owner prefers no financing, the "Pay in full when we can afford it" switch makes Faisla recommend cash whenever it's safe. With Rs 2 crore it does, and it still tells him LTFF would be Rs 2.79 lakh cheaper.
15. **"Why 2 months as the safety line?"**
    A simple, explainable buffer for salaries and rent with no sales counted. It's a floor, not a forecast, and it's stated on screen.
16. **"Did you include tax?"**
    Yes. 29% company tax and depreciation (25% initial allowance, then 15% reducing balance on plant and machinery). Profit on Islamic financing is deductible. For Ijarah, rentals are deductible and there's no depreciation during the lease. Tax savings arrive at each year end and are discounted at 10.65% after tax.
17. **"Why does Ijarah beat Diminishing Musharakah at the same rate?"**
    Ijarah rentals are fully deductible as you pay them, while with Diminishing Musharakah you depreciate the machine over 10 years. Earlier tax savings are worth more today.
18. **"What if KIBOR rises?"**
    The stress slider shows it. At +2% or +4%, Ijarah and Diminishing Musharakah get dearer; Islamic LTFF doesn't move (it follows the SBP policy rate), so the recommendation stays.
19. **"What about bank fees, takaful, collateral?"**
    Fees are an editable field (at 2%, LTFF still wins and break-even rises to 10.34%). Takaful and collateral are listed in the assumptions, and the request to the bank asks about them.
20. **"Is the runway realistic? It ignores sales."**
    Deliberately. It's the worst case (a floor), labelled "counts no sales income".
21. **"How is this financial operations and not procurement?"**
    It covers all five areas in the brief:
    - **financial planning:** true cost, tax, cash left, stress test;
    - **credit and risk:** financing choice, eligibility, cash safety, supplier reputation;
    - **accounting automation:** quotation to structured data, arithmetic checks;
    - **payments:** installment schedules, request to the bank;
    - **fraud detection:** payment-fraud check.
22. **"Is LTFF eligibility handled?"**
    Islamic LTFF only appears for exporters (a company setting). The real rule is roughly 50% of sales exported or US$5m of exports, which the bank confirms. Non-exporters get Ijarah or Diminishing Musharakah.
23. **"LTFF allows up to 10 years. Why 36 months?"**
    A common SME tenor, and it's editable on the Financing page. Longer tenors lower the monthly payment and keep more cash.

### Islamic finance
24. **"Is Faisla Shariah-certified?"**
    No, and we don't claim it. Faisla compares Shariah-compliant products; the bank's Shariah board approves the product. Faisla's request to the bank asks for that approval.
25. **"Explain Diminishing Musharakah / Ijarah / Murabaha in one line each."**
    - **Diminishing Musharakah:** you and the bank co-own the machines; you buy the bank's share monthly and pay rent on its share.
    - **Ijarah:** the bank owns the machines and leases them to you; ownership transfers at the end.
    - **Murabaha:** the bank buys and sells to you at a disclosed fixed profit, paid in installments.
26. **"Why do Islamic rates use KIBOR?"**
    KIBOR is the market benchmark for pricing. The contract is asset-backed rent or profit, not interest on a loan, and late payments go to charity, not the bank.
27. **"Why Islamic first?"**
    Pakistan's 26th Amendment requires riba to be eliminated before 1 January 2028, and Islamic banks already hold a large share of financing. Recommending interest-based loans would be wrong for this market. Conventional options are visible only on request, for comparison.

### Demo and technical
28. **"Is the supplier reply live?"**
    In the demo we use the stored reply, or paste it. With a Gmail account connected, Faisla sends real price requests and reads replies every 10 seconds. On the live site, email is simulated because we didn't connect a mailbox.
29. **"Are the market prices real?"**
    The Jack F5 has 3 real new listings with links (median Rs 70,000) and real product reviews. The benchmark table, supplier names and supplier reviews are simulated and labelled. Live search for other items returns real store listings.
30. **"Why does the search show so few results?"**
    It's strict on purpose: right specs, price actually on the page, new item, real product page. Most Pakistani shops don't print prices ("call for price"), so we show nothing rather than something wrong. You can paste a link you found.
31. **"How do you know the fraud check works?"**
    The rules are unit-tested. The demo email triggers all four signals: different IBAN, "account changed" wording, a personal account title, and a Gmail sender. Payment stays blocked until phone confirmation.
32. **"What if a real supplier legitimately changes bank?"**
    That's exactly when you should call them. Faisla flags it, and after the owner confirms by phone on a known number, it unblocks.
33. **"How is data protected?"**
    Hashed passwords, httpOnly sessions checked against the database, secrets only in environment variables, no real private data (the demo is fictional), and emails only to test inboxes.
34. **"What happens if I upload a bad photo?"**
    The confirm screen shows what was read and flags problems; you can fix any field or type the quotation in.
35. **"Can it handle multi-line quotations?"**
    Yes, every line is priced together.
36. **"How do you test?"**
    194 automated unit tests pin every finance number, the fraud rules, the parsers and the memo check. Playwright browser scripts run every flow (demo, fraud, Islamic, pay in full, choose-your-own, describe-a-need) against the live site.

### Creativity, SDG and industrial impact
37. **"What's original here?"**
    The combination:
    - AI reading messy Pakistani business inputs (Roman Urdu, lakh/crore, photos);
    - tested Islamic-finance comparison with tax;
    - a payment-fraud check inside the purchase flow;
    - a memo whose every number is verified.
38. **"Which SDGs?"**
    SDG 8.3 (SME growth), SDG 8.10 (access to financial services) and SDG 9.3 (SME access to affordable credit): helping small firms find cheap, Shariah-compliant financing and avoid costly plans.
39. **"Who pays for this?"**
    SMEs pay a monthly subscription. Islamic banks get clean, decision-ready financing requests; suppliers could pay to be listed.
40. **"How big is the impact?"**
    In the demo, one purchase saves Rs 5.8 lakh (Rs 4.7 lakh after tax) and keeps 2.6 months of cash instead of 1.3. A 2020 SMEDA survey found most SMEs face cash-flow shortages. Fraud prevention can save the whole advance.
41. **"Would banks adopt it?"**
    It sends them complete, structured requests (company, purchase, financing asked, repayment schedule), which cuts their back-and-forth.
42. **"What would you build next?"**
    WhatsApp intake (photos, voice notes), payment reminders after the decision, payback/NPV ("should I buy at all?"), an existing-loan register, Urdu interface, bank integrations.

### Teamwork and honesty
43. **"What did you build here vs reuse?"**
    Everything was built during AICON'26 (commit history from 10 October). We used open-source libraries, OpenAI and Tavily APIs, and AI coding assistants, as the rules allow. The finance engine, AI-plus-checks pipeline, fraud rules and app are ours.
44. **"Who did what?"**
    Prepare your own split: who did the finance checks, demo data, slides and testing. Be specific and honest.
45. **"What doesn't work yet?"**
    Be upfront:
    - email is simulated without a mailbox;
    - live search returns few results;
    - the benchmark and supplier reviews are simulated;
    - tax is a company-tax profile, not advice;
    - rates are illustrative until the bank confirms.

---

## 6. Tricky follow-ups and safe answers
- **"Your KIBOR is wrong."** It's illustrative (11.8%); 6-month KIBOR was 12.41% on 9 Oct. It's editable, and the stress slider shows the recommendation doesn't change.
- **"8.84% looks made up."** It's 8.5% compounded monthly: (1 + 0.085/12)^12 − 1.
- **"Before-tax saving is negative in your no-B, non-exporter case!"** Yes, −5,496 before tax but +1,71,935 after tax. Ijarah's rental deductions make the difference. That's why we show both.
- **"What if every option is unsafe?"** Faisla picks the lowest true cost and says plainly "every option leaves little cash" (e.g. only Rs 50 lakh in the bank leaves 1.22 months).
- **"Why is cash cheaper in today's money at an 8% discount rate but not recommended?"** Because it leaves 1.33 months of costs; safety comes first. Turn on "Pay in full" if you prefer.

## 7. Don't say
- "Real market survey", "the supplier reviews are real", "SBP confirmed 8.5%", "current KIBOR is 11.8%", "tax advice", "Shariah certified", "SBP AI sandbox".
- "The reply came live from a phone", unless you actually send one on stage.
