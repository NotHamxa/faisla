# Faisla glossary (plain language, for non-finance people)

Every term used in the app, the slides and the docs. Each entry has three parts:

- **Means:** a one-sentence definition in everyday words.
- **Demo example:** the term with our demo numbers, where possible.
- **Say to a judge:** one line you can use out loud.

Demo facts used throughout:

- Hamza Garments (fictional), Rs 1 crore cash, Rs 35 lakh a month fixed costs, 29% tax, 15% discount rate.
- 80 × Jack F5 machines.
- Supplier A: Rs 60 lakh, or 12 × Rs 5 lakh at "0%", or 8% off for cash = Rs 55.2 lakh.
- Supplier B: Rs 67,000 each = Rs 53.6 lakh.
- Islamic LTFF at 8.5%, 36 months, 10% own share.

---

> ### Explain the demo in 60 seconds
>
> Hamza wants 80 sewing machines.
>
> **The quote.** Supplier A quotes Rs 60 lakh: either 12 monthly payments of Rs 5 lakh at "0% markup", or Rs 55.2 lakh cash. Faisla reads the quotation photo with AI and checks the maths. The "0%" plan costs Rs 4.8 lakh more than cash. That works out to **16.9% a year** for paying later.
>
> **The market.** Real OLX listings say Supplier A is about 9% above market, and the supplier has warranty complaints.
>
> **Competing offers.** Faisla emails other dealers. One replies in Roman Urdu, "67 hazar per unit", so Rs 53.6 lakh.
>
> **The fraud attempt.** A fake "our account has changed, pay today" email arrives. Faisla's code flags it and blocks payment until Hamza confirms by phone.
>
> **The decision.** Faisla compares every Shariah-compliant way to pay, in today's money, before and after tax:
> - Paying cash would leave only **1.33 months** of salaries and rent in the bank.
> - The winner is **SBP's Islamic LTFF at 8.5%**. It saves **Rs 5.8 lakh** against the "0%" plan (**Rs 4.7 lakh after tax**) and keeps **2.59 months** of costs in the bank.
>
> AI writes the memo, code checks every number, and Faisla emails an Islamic bank for a term sheet.
>
> **AI reads, code calculates, the owner decides.**

> ### 5 numbers to remember
>
> | Number | What it is | Say it as |
> | --- | --- | --- |
> | **Rs 5.8 lakh** (Rs 5,79,103) | Saving vs the "0%" plan, in today's money, before tax | "Saves 5.8 lakh" |
> | **Rs 4.7 lakh** (Rs 4,73,603) | Same saving after tax | "4.7 lakh even after tax" |
> | **16.9%** | Yearly cost of paying later on the "0% markup" plan | "The 0% plan costs 17% a year" |
> | **8.5%** | SBP Islamic LTFF rate = policy rate 11.5% − 3% | "Islamic LTFF at 8.5%" |
> | **2.59 vs 1.33 months** | Months of costs left in the bank: Islamic LTFF vs paying cash | "Two and a half months of salaries kept, instead of just over one" |

---

## Contents

1. [General money and accounting](#1-general-money-and-accounting)
2. [Loans and financing (conventional)](#2-loans-and-financing-conventional)
3. [Islamic finance](#3-islamic-finance)
4. [Pakistan-specific](#4-pakistan-specific)
5. [Tax](#5-tax)
6. [Faisla's metrics](#6-faislas-metrics)
7. [Fraud](#7-fraud)
8. [Tech and AI words you may be asked about](#8-tech-and-ai-words-you-may-be-asked-about)
9. [Sources](#sources)

---

## 1. General money and accounting

| Term | Means | Demo example | Say to a judge |
| --- | --- | --- | --- |
| **Lakh / crore** | South Asian number words: 1 lakh = 1,00,000 (one hundred thousand). 1 crore = 1,00,00,000 (ten million) | Rs 1 crore cash. Rs 53,60,000 = 53.6 lakh | "We show rupees the way owners write them: lakh and crore" |
| **Hazar** | Urdu for "thousand" | "67 hazar per unit" = Rs 67,000 | "Faisla reads '67 hazar' as sixty-seven thousand" |
| **SME** | Small and medium-sized enterprise: a business too small to have its own finance team | Hamza Garments | "Our user is the SME owner with no CFO" |
| **CFO** | Chief Financial Officer: the person in a big company who decides how to fund purchases and keep cash safe | "A CFO in a box" | "Faisla gives a small business the decision a CFO would make" |
| **Quotation (quote)** | A supplier's written price offer, with payment terms and validity | Al-Noor's quote ANIM/Q/2026/0412, valid 15 days | "It starts from the quotation the owner already has" |
| **RFQ** | Request for quotation: an email asking a supplier to quote a price | Faisla emails Madina Sewing Solutions and Karachi Garment Tech | "AI writes the RFQ; Faisla sends it and watches the inbox" |
| **Offer** | One supplier's price for the item, as a row Faisla can compare | Offer A Rs 60 lakh, offer B Rs 53.6 lakh | "Every confirmed price becomes an offer" |
| **Cash price** | What you pay if you pay everything now, after any cash discount | A: Rs 60 lakh × (1 − 8%) = Rs 55.2 lakh. B: Rs 53.6 lakh | "We compare everything against the cash price" |
| **Cash discount** | A price cut for paying in full upfront | 8% off Supplier A | "The cash discount is what tells you the '0%' plan isn't free" |
| **Installment** | One of several equal payments spread over time | 12 × Rs 5,00,000, or 36 × Rs 1,52,282 | "Installments are paid monthly, starting a month after delivery" |
| **Upfront / paid at delivery** | Money that leaves the bank on day one (month 0) | Rs 5,36,000 own share for Islamic LTFF. Rs 53.6 lakh for cash | "Upfront cash is what drains the runway" |
| **Fixed costs** | Bills you pay every month whatever you sell: salaries, rent, utilities | Rs 35 lakh a month | "Runway is measured in months of fixed costs" |
| **Cash flow** | Money coming in and going out, month by month | 36 monthly installments are a cash flow | "Faisla looks at when each rupee leaves, not just how many" |
| **Liquidity** | How much cash you can use right now | Paying Rs 53.6 lakh cash leaves Rs 46.4 lakh | "Cheapest isn't safest if it kills your liquidity" |
| **Benchmark** | A reference price to compare against | Median Rs 68,700 from a 60-row simulated table | "The benchmark is simulated and labelled; the web prices are real" |
| **Median** | The middle value when you sort a list. Not pulled up by one crazy price | Web prices 63,000 / 70,000 / 79,000 → median Rs 70,000 | "We use the median so one outlier can't move the answer" |
| **Outlier** | A price far away from the rest, often a mistake or a different item | Code drops prices far from the median, e.g. below half or above twice the median for "Describe what I need" | "Code drops outliers; AI doesn't decide what counts" |
| **% above market** | How much more the quote is than the market reference | 75,000 ÷ 68,700 − 1 ≈ 9% above the simulated benchmark → "Overpriced". About 7% above the real web median of Rs 70,000 | "Supplier A is about 9% above our benchmark, 7% above real listings" |
| **Depreciation** | Spreading the cost of a machine over its useful life in the accounts (and for tax) | Rs 53.6 lakh written off over 10 years | "Depreciation is a tax deduction, so it changes the real cost" |
| **Asset** | Something the business owns that has value, like machines | 80 Jack F5 machines | "Islamic financing is backed by the asset itself" |
| **Scrap value** | What the machine is worth at the end of its life | Ignored, because it is the same for every option | "Scrap value cancels out, so we leave it out" |
| **Payback** | How long until a purchase pays for itself | Not built yet (roadmap: investment check) | "Next we add 'should I buy at all?' with payback and NPV" |

---

## 2. Loans and financing (conventional)

Faisla shows these only when the owner chooses "Islamic and conventional". They are labelled "Conventional · interest-based" and are never recommended.

| Term | Means | Demo example | Say to a judge |
| --- | --- | --- | --- |
| **Interest** | The price of borrowing money, charged as a % of the amount lent | A conventional loan at 14.8% | "We never call Islamic profit 'interest'" |
| **Loan / term loan** | Money lent by a bank, repaid with interest over a fixed period | "B, conventional loan 14.8%" (only under "Islamic and conventional") | "Conventional loans are for comparison only and never recommended" |
| **Principal** | The amount borrowed (or financed), before any interest or profit | Rs 48,24,000 | "Profit is charged on the outstanding principal only" |
| **Markup** | Pakistani business word for interest or profit added to a price | The supplier claims "0% markup" | "The '0% markup' claim is false in effect: it costs 16.9% a year" |
| **Down payment** | The part of the price you pay yourself at the start | 10% = Rs 5,36,000 (Islamic name: own share / security deposit) | "10% upfront, 90% financed" |
| **Tenor** | How long the financing lasts | 36 months | "36 months for a like-for-like comparison; banks may offer longer" |
| **EMI** | Equated monthly installment: the fixed monthly payment on a conventional loan | Conventional loan: Rs 1,66,753 | "For Islamic products we say installment or rental, not EMI" |
| **Amortisation schedule** | A month-by-month table splitting each payment into profit (or interest) and principal | Attached to the term-sheet email as installment-schedule.txt | "The bank email attaches the full 36-month schedule" |
| **Processing fee** | A one-time bank charge for setting up financing | 0% by default, editable on the Assumptions card | "Change the fee and every row recalculates" |
| **Collateral / security** | Something the bank can claim if you don't pay | Not included; the bank email asks | "Collateral is on the Assumptions card and in the bank email" |
| **Term sheet** | A bank's written summary of the financing it offers: rate, fees, security, tenor | "Request term sheet" emails an Islamic bank's SME desk | "Faisla doesn't guess the bank's final rate; it asks for a term sheet" |
| **SME desk** | The bank team that handles small-business financing | A team test inbox in the demo | "The request goes to an Islamic bank's SME desk" |
| **Spread** | The margin a bank adds on top of a benchmark rate | KIBOR + 3% | "Our 14.8% is KIBOR about 11.8% plus a 3% spread" |
| **Floating vs fixed rate** | Floating moves with a benchmark (KIBOR). Fixed is agreed upfront | Diminishing Musharakah and Ijarah float with KIBOR. Islamic LTFF follows the SBP rate | "That's why the KIBOR stress test moves some rows and not others" |
| **Repricing** | When a floating rate is reset to the new benchmark | Diminishing Musharakah and Ijarah reprice; the stress test shows +2% | "Only KIBOR-linked rows reprice" |
| **DSCR** | Debt service coverage ratio: profit ÷ loan payments. Banks want it above about 1.25 | Roadmap (bank loan pack) | "Next: a loan pack with DSCR, the first thing a banker asks" |
| **Refinance scheme** | A government or SBP scheme where the central bank funds banks so they can lend cheaply for a purpose | LTFF / Islamic LTFF | "Islamic LTFF is SBP's cheap refinance for exporters" |

---

## 3. Islamic finance

**Big idea:** Islamic finance avoids riba. Instead of lending money for interest, the bank buys, co-owns or leases a real asset and earns profit or rent from it.

| Term | Means | Demo example | Say to a judge |
| --- | --- | --- | --- |
| **Riba** | Any fixed increase charged on a loan of money, usually translated as interest or usury. Prohibited in Islam | Pakistan must eliminate it before 1 Jan 2028 | "Faisla is built for Pakistan's riba-free deadline" |
| **Shariah** | Islamic law and its principles, including rules for trade and finance | "Shariah-compliant only" is the default preference | "Shariah-compliant is the default, not an add-on" |
| **Shariah-compliant** | A product structured so it follows Shariah: asset-backed, no riba, no excessive uncertainty | Diminishing Musharakah, Ijarah, Islamic LTFF, Murabaha, cash, the deferred-price plan | "Only Shariah-compliant rows can be recommended" |
| **Shariah board** | A panel of Islamic scholars at each Islamic bank that approves its products and contracts | The term-sheet email asks for the board's approval or fatwa reference | "Final compliance is the bank's Shariah board's call, not ours" |
| **Fatwa** | A formal religious ruling by a qualified scholar | Requested in the term-sheet email | "We ask the bank for its approval reference" |
| **AAOIFI** | Accounting and Auditing Organization for Islamic Financial Institutions. It sets the international Shariah standards that SBP has adopted for Pakistani banks | Standard 8 (Murabaha), Standard 9 (Ijarah), Standard 3 (late payment) | "Our modelling follows the AAOIFI standards SBP adopted" |
| **Asset-backed** | The financing is tied to a real thing the bank buys, co-owns or leases, not just money | The 80 machines | "The bank earns from the machines, not from lending money" |
| **Profit rate vs interest rate** | An Islamic bank's profit rate is its return from the sale, partnership or lease. Interest is a charge on lent money. The number can look similar (both priced off KIBOR) but the contract is different | Islamic LTFF profit rate 8.5% | "Same benchmark, different contract: a real asset, no compounding, late payment to charity" |
| **Murabaha** | Cost-plus sale. The bank buys the item and sells it to you at cost plus an agreed profit, paid later in installments. The price is fixed at the contract | A preset on the Financing page (not in the demo set). Not moved by the KIBOR stress test | "Murabaha's price is fixed at signing, so KIBOR can't move it" |
| **Bay' muajjal (deferred-price sale)** | Selling something now for a higher price paid later. Permissible if the price is fixed upfront and nothing is added for late payment | The supplier's "0% markup" plan: Rs 60 lakh later vs Rs 55.2 lakh now | "The '0%' plan is permissible, but paying later costs 16.9% a year" |
| **Deferred-price plan** | Faisla's plain name for the supplier's bay' muajjal installment plan | Row "A, deferred-price plan ("0%")" | "We call it a deferred-price plan, not hidden interest" |
| **Musharakah** | A partnership: partners share ownership, profit (as agreed) and loss (by capital share) | The basis of Diminishing Musharakah | "Musharakah means partnership" |
| **Diminishing Musharakah** | Co-ownership that shrinks. You and the bank co-own the asset. Each month you pay rent on the bank's share and buy some of its units, until you own it all | "B, Diminishing Musharakah 14.8%": 10% own share, 36 × Rs 1,66,753 | "Each installment = rent on the bank's share + buying a slice of it" |
| **Ijarah** | An Islamic lease. The bank owns the asset and rents it to you. You pay a security deposit and monthly rentals. The bank as owner handles takaful. At the end, ownership passes to you by a separate sale or gift | "B, Ijarah 14.8%": deposit Rs 5,36,000 + 36 rentals of Rs 1,66,753 | "Ijarah wins after tax, because rentals are deductible as you pay them" |
| **Rental** | The monthly payment under Ijarah | Rs 1,66,753 | "Under Ijarah we say rental, not installment" |
| **Security deposit** | Money you leave with the bank at the start of an Ijarah. It is adjusted against the purchase price at the end | 10% = Rs 5,36,000, adjusted at month 36, so the net flow is nil | "The deposit becomes the purchase price at the end" |
| **Own share / your share** | Your contribution at the start of a Diminishing Musharakah (the part you own from day one) | 10% = Rs 5,36,000 | "Hamza owns 10% from day one" |
| **Takaful** | Islamic insurance. Members pool money to cover each other's losses, instead of buying conventional insurance | Listed in the Shariah notes; the bank email asks who arranges it and the cost | "Takaful replaces conventional insurance on the machines" |
| **Late-payment charity** | If you pay late, you promise to give a fixed amount to charity. It is not income for the bank, so the bank doesn't profit from your delay | Shariah notes; asked in the term-sheet email | "Late payment goes to charity, never to the bank" |
| **No compounding** | Profit is never charged on unpaid profit; late payment doesn't grow the debt | Profit = rate ÷ 12 on the outstanding share only | "Profit is charged only on what's outstanding, never compounded" |
| **Mudaraba** | A partnership where one side gives money and the other gives work; profit is shared | SBP funds banks for Islamic LTFF on a Mudaraba basis | "Even SBP's funding to the bank is Shariah-structured" |
| **Islamic window / Islamic bank** | A full Islamic bank (e.g. Meezan) or an Islamic branch of a conventional bank | The term sheet goes to an Islamic bank's SME desk | "Islamic banks hold about 38% of Pakistan's bank financing" |

---

## 4. Pakistan-specific

| Term | Means | Demo example | Say to a judge |
| --- | --- | --- | --- |
| **SBP** | State Bank of Pakistan, the central bank. It sets the policy rate and runs refinance schemes like LTFF | Source of the 8.5% formula | "SBP sets the rate that Islamic LTFF follows" |
| **Policy rate** | SBP's main interest rate. Other rates in the economy move with it | 11.5% (set Apr 2026, held 14 Sep 2026) | "Policy rate 11.5%, so Islamic LTFF is 11.5 − 3 = 8.5%" |
| **KIBOR** | Karachi Interbank Offered Rate: the rate banks quote to lend to each other, published for different tenors (3-month, 6-month, 1-year). It is the benchmark for most business financing, Islamic included | App uses ≈ 11.8% (illustrative). The 6-month offer was 12.41% on 9 Oct 2026 | "Islamic banks price profit as KIBOR plus a spread; that's why we stress-test KIBOR" |
| **LTFF** | Long-Term Financing Facility: SBP's cheap financing for exporters buying new plant and machinery. End-user rate = policy rate − 3% | Conventional LTFF 8.5% (shown only under "Islamic and conventional") | "LTFF is for exporters buying new machinery" |
| **ILTFF (Islamic LTFF)** | The Shariah-compliant version of LTFF, offered through Islamic banks (here via Diminishing Musharakah). Same rate: policy rate − 3%. Up to 10 years including up to 2 years' grace | "B, Islamic LTFF 8.5%", Recommended | "Exporters can get Islamic LTFF at 8.5%; most never ask" |
| **E-LTFF / E-ILTFF** | Newer versions where banks lend from their own funds and the government subsidises the markup, as SBP refinance is phased out (FY24–28) | Caveat on the 8.5% | "The scheme is changing, so Faisla asks the bank to confirm" |
| **Exporter** | A business that sells abroad. Required for (Islamic) LTFF | Hamza Garments is an exporter (switch in Settings) | "Turn off 'exporter' and Islamic LTFF disappears; Ijarah wins" |
| **FBR** | Federal Board of Revenue, Pakistan's tax authority | Tax treatment of rentals and depreciation | "Tax rules follow the Income Tax Ordinance 2001 as we read it" |
| **NTN** | National Tax Number: a business's tax ID from FBR | Printed on the demo quotation: 4217736-8 | "The quotation shows the supplier's NTN" |
| **IBAN** | International Bank Account Number. In Pakistan: 24 characters, PK + 2 check digits + 4-letter bank code + 16 digits | Al-Noor: PK76 MEZN 0002 3101 0456 7890 (Meezan) | "Faisla reads the IBAN off the quotation and remembers it" |
| **26th Amendment** | Oct 2024 change to Pakistan's Constitution: eliminate riba "before 1 January 2028" | Why Islamic finance first | "Pakistan has a constitutional deadline to end riba before 2028" |
| **Federal Shariat Court (FSC)** | The court that rules whether laws follow Islam. In 2022 it set 31 Dec 2027 to end riba | Same deadline | "The FSC deadline is 31 December 2027" |
| **OLX** | Pakistan's biggest classifieds website | Real Jack F5 listings: Rs 79,000 and Rs 70,000, Lahore | "These are real OLX listings, with links" |
| **Roman Urdu** | Urdu written in English letters, how most people text in Pakistan | "Bhai, 80 machines 67 hazar per unit final, delivery 10 din, 1 saal warranty" | "Suppliers reply in Roman Urdu; AI reads it, code double-checks the price" |
| **Din / saal / qist** | Roman Urdu for day / year / installment | "10 din" = 10 days, "1 saal" = 12 months | — |
| **SMEDA** | Small and Medium Enterprises Development Authority | Source of the "82% cash-flow problems" survey (2020) | "In a 2020 SMEDA survey, 82% of SMEs reported cash-flow problems" |
| **Raast** | SBP's instant payment system | Roadmap (payments) | "Payments through Raast are on the roadmap" |
| **PDC** | Post-dated cheque, a common way dealers take installments | Roadmap (more payment shapes) | — |

---

## 5. Tax

| Term | Means | Demo example | Say to a judge |
| --- | --- | --- | --- |
| **Tax rate** | The share of profit paid as income tax | 29% (the company rate), editable | "29% is the company rate; a sole proprietor enters their own" |
| **Tax-deductible** | A cost you can subtract from profit before tax is worked out, so it lowers your tax | Profit, Ijarah rentals, depreciation, fees | "Every deductible rupee saves 29 paisa of tax" |
| **Tax saving (tax shield)** | Tax you don't pay because of a deduction = deduction × tax rate | Islamic LTFF saves Rs 17,45,262 of tax over 10 years | "Tax savings are counted when they actually arrive" |
| **Initial allowance** | An extra first-year tax deduction for new plant and machinery: 25% of cost | 25% × Rs 53.6 lakh = Rs 13.4 lakh in year 1 | "New machinery gets a 25% initial allowance in year 1" |
| **Reducing balance depreciation** | Each year you deduct a fixed % of what's left (not of the original cost) | 15% a year on the remaining value | "15% reducing balance, as for plant and machinery" |
| **Depreciation schedule (Faisla's)** | 25% initial allowance in year 1, plus 15% of the remainder (also in year 1), then 15% a year, with the rest written off in year 10 | Year 1 Rs 19,43,000 · year 2 Rs 5,12,550 · year 10 Rs 9,31,100 (on Rs 53.6 lakh) | "It's in Show calculation for every row" |
| **Depreciation base** | The cost the depreciation is calculated on: what each option actually pays for the machines | "0%" plan Rs 60 lakh; B cash and Islamic LTFF Rs 53.6 lakh | "We depreciate what you actually pay" |
| **Lessee / lessor** | Lessee rents the asset (Hamza); lessor owns it (the bank) | Under Ijarah the lessee claims no depreciation during the lease | "Under Ijarah the bank owns it, so Hamza deducts rentals, not depreciation" |
| **Income Tax Ordinance 2001 (ITO)** | Pakistan's main income-tax law. s.23 = initial allowance; s.28(1)(b) = lease rentals to a scheduled bank are deductible | Basis of our tax modelling | "Ijarah rentals are deductible under s.28(1)(b)" |
| **Minimum tax / super tax** | Extra Pakistani tax rules (tax on turnover, extra tax on high income) | Not modelled (a stated limitation) | "We list what we simplify on the Assumptions card" |
| **Withholding tax** | Tax deducted at source when you pay a supplier | Not modelled | — |

---

## 6. Faisla's metrics

| Term | Means | Demo example | Say to a judge |
| --- | --- | --- | --- |
| **Present value (PV)** | What a set of future payments is worth in today's money. A rupee paid later costs you less than a rupee paid now, because you could use that money meanwhile | Islamic LTFF PV Rs 49,87,935, even though you pay Rs 60,18,145 in total | "PV puts every way to pay on the same footing: today's rupees" |
| **PV before tax** | PV of the actual payments, discounted at 15% a year | "0%" plan Rs 55,67,038 vs Islamic LTFF Rs 49,87,935 | "Before tax, Islamic LTFF is 5.8 lakh cheaper than the '0%' plan" |
| **After-tax PV** | PV of the payments minus the tax they save, discounted at the after-tax rate 10.65% | Islamic LTFF Rs 40,13,687 vs "0%" plan Rs 44,87,290 | "After tax it's still 4.7 lakh cheaper" |
| **Discount rate / cost of money** | How much a rupee today is worth more than a rupee next year, for this business. Roughly what it costs you to get money (≈ KIBOR + 3%) | 15% a year = 1.1715% a month | "15% is about what money costs this business; it's editable" |
| **After-tax discount rate** | The discount rate after tax relief: 15% × (1 − 29%) | 10.65% | "After tax, we discount at 10.65%" |
| **Effective annual cost / hidden rate** | The true yearly rate you pay by choosing installments instead of the cash price, found by solving cash price = PV of installments | "0%" plan: 1.3067% a month → 16.86% ≈ **16.9% a year** | "The '0% markup' plan really costs 16.9% a year" |
| **Effective vs simple rate** | Effective compounds monthly: (1 + r)^12 − 1. Simple just multiplies: r × 12 | 16.86% effective vs 15.68% simple | "We show both; the effective rate is the honest one" |
| **Installment timing** | Whether the first payment is on delivery or one month after. It changes the cost | One month after: 16.9%. On delivery: 20.3% | "Timing is an input, read from the quotation" |
| **Annuity / installment formula** | The standard formula for equal monthly payments: P·i·(1+i)^n ÷ ((1+i)^n − 1), i = yearly rate ÷ 12 | P = 48,24,000, 8.5%, 36 months → Rs 1,52,282 | "Same formula banks use" |
| **Runway** | How many months your cash covers your fixed costs plus any new monthly payment: (cash − upfront) ÷ (fixed costs + new payment). Counts no sales, so it's a worst-case floor | Today 2.86 · Islamic LTFF **2.59** · B cash **1.33** | "Paying cash leaves 1.3 months of salaries; Islamic LTFF keeps 2.6" |
| **Safety line (2 months)** | Faisla's rule: the recommended option must leave at least 2 months of fixed costs. Below 1.5 months it says "Salaries at risk" | A cash 1.28 → "Salaries at risk" | "We won't recommend anything that leaves less than two months of costs" |
| **Break-even discount rate** | The discount rate at which financing and paying cash cost the same. If your money costs more than this, financing wins | 8.84% (shown as 8.8%) for Islamic LTFF vs B cash | "Islamic LTFF beats cash for anyone whose money costs more than 8.8%" |
| **Stress test** | "What if?" Move KIBOR up (0 to +4% in 0.5% steps) and see whether the answer changes | +2%: Diminishing Musharakah and Ijarah go to 16.8% (Rs 1,71,509 a month), Islamic LTFF stays 8.5%. "Recommendation unchanged" | "Even if KIBOR rises 2%, the answer holds" |
| **EMI / installment** | The fixed monthly payment. Faisla says "installment" (or "rental" for Ijarah) | Rs 1,52,282 (Islamic LTFF) | "We avoid 'EMI' for Islamic products" |
| **Down payment / security deposit / own share** | The 10% paid at delivery. The name depends on the product: own share (Diminishing Musharakah), security deposit (Ijarah), advance (Murabaha), down payment (conventional) | Rs 5,36,000 | — |
| **Depreciation / initial allowance / reducing balance** | See the Tax section. 25% initial allowance in year 1, then 15% reducing balance, 10-year life | Rs 19,43,000 in year 1 on Rs 53.6 lakh | "Tax depreciation follows Pakistani rules for new machinery" |
| **Verdict** | The one-line label on each row | "Recommended", "Paying later costs 16.9% a year", "Cheapest price, drains cash", "Salaries at risk", "Tight on cash", "Safe, dearer than Islamic LTFF", "Interest-based, for comparison only", and (only when "pay in full" picks cash) "Cheaper in today's money, but uses financing" | "Each row tells the owner, in plain words, why it won or lost" |
| **Recommended** | Lowest after-tax PV among Shariah-compliant options that keep 2+ months of runway (or cash, if "pay in full" is on and cash keeps 2+ months) | B, Islamic LTFF 8.5% | "Cheapest in today's money, after tax, that keeps you safe" |
| **Pay in full when affordable** | Settings switch "Pay in full when we can afford it": prefer buying outright whenever cash still leaves 2+ months | No change in the demo (cash leaves 1.33). With Rs 2 crore it recommends B cash | "If you'd rather not finance, Faisla respects that, as long as it's safe" |
| **Show calculation** | A button on every row that lists each formula, input and result | "0%" plan: 1.3067% a month → 16.86% a year | "Every number on screen has its working shown" |
| **Assumptions card** | The list of everything the comparison takes as given: preference, discount rate, fees, timing, tax, Shariah notes, LTFF eligibility | Fee field editable there | "Everything we assume is written down and editable" |
| **Savings vs baseline** | PV of the supplier's quoted plan minus PV of the recommended option | Rs 5,79,103 before tax, Rs 4,73,603 after tax | "Savings are measured against what the supplier offered" |
| **Market check** | Quoted price vs the benchmark median and real web prices | ~9% above market, "Overpriced" | — |
| **Reputation flag** | Good / Mixed / Red flags / Not enough reviews, from fixed code rules (≥ 3 reviews needed; red = any fraud complaint, average below 3, or 3+ serious complaints) | Al-Noor: Red flags (3 warranty complaints). Jack F5: Good | "AI reads reviews; code decides the flag" |
| **Number check** | Code compares every number in the AI-written memo with the calculation. An unknown number means a retry, then a template | "✓ Every number checked against the calculation" | "The AI can't sneak a number into the memo" |

---

## 7. Fraud

| Term | Means | Demo example | Say to a judge |
| --- | --- | --- | --- |
| **BEC (business email compromise)** | A fraud where criminals pose as a supplier (or hack their email) and ask you to pay a "new" bank account | The demo fraud email "from" Al-Noor | "The most common SME payment fraud: 'our account has changed'" |
| **Invoice / payment-redirection fraud** | Another name for BEC aimed at supplier payments | Same | — |
| **IBAN checksum (mod-97)** | A built-in maths check in every IBAN (ISO 13616). Rearrange the characters, turn letters into numbers, divide by 97: a real IBAN leaves 1. Catches typos and made-up numbers | Both demo IBANs pass. The fraud is caught because the IBAN is *different*, not invalid | "The checksum catches typos; the 'account on file' rule catches fraudsters" |
| **Account on file** | The supplier's bank account Faisla already knows, from the quotation or their first email | PK76 MEZN … (Meezan) from the quotation | "Any email asking to pay a different account is high risk" |
| **Account title** | The name the bank account is registered under | Fraud email: "Imran Qureshi", not "Al-Noor Industrial Machines" | "A personal name on a company's account is a warning sign" |
| **Free webmail domain** | Email from Gmail, Yahoo, Hotmail and so on, instead of the company's own domain | alnoor.machines.fsd@gmail.com instead of @alnoor-machines.pk | "A switch from a company domain to Gmail is a red flag" |
| **Urgency / account-change language** | Pressure words like "account has changed", "pay today", "urgent", and in Roman Urdu "naya account", "aaj hi", "fauran" | "Due to our annual audit our bank account has changed" | "Fraudsters rush you; Faisla spots the wording in English and Roman Urdu" |
| **Risk levels** | High = IBAN changed or fails the checksum. Medium = wording, title or domain. High blocks the term-sheet request | Demo fraud email: High risk | "High risk blocks payment until the owner confirms" |
| **Phone confirmation** | The owner calls the supplier on a number they already had (never one from the email) and ticks the box to unblock | "I confirmed this account by phone on a number I already had" | "The fix for BEC is a phone call; Faisla makes it mandatory" |
| **False positive** | A warning on something that turns out to be fine | A real supplier who genuinely changed banks | "A false alarm costs a phone call; a missed fraud costs lakhs" |

---

## 8. Tech and AI words you may be asked about

| Term | Means | Say to a judge |
| --- | --- | --- |
| **LLM** | Large language model: AI that reads and writes text (and, with vision, images) | "We use LLMs to read, never to calculate" |
| **Vision model** | An AI model that reads images and PDFs | "It read 12 of 12 fields on our test quotation" |
| **Structured output / JSON schema** | Forcing the AI to answer in a fixed format with typed fields, checked by Zod | "The AI fills a form; code checks the form" |
| **Hallucination** | When AI states something false with confidence | "No number on screen comes from AI, and every memo number is checked" |
| **Model tier** | Faisla picks a cheap or a strong model per task (vision, fast, read, write) | "Cheap models do easy reading; a full demo run costs about $0.002" |
| **Fallback** | What happens when AI or the internet fails: cached data, templates, the code parser, or asking the owner | "It never guesses" |
| **Cache** | Saved results reused instead of searching again | "The Jack F5 market data is cached real listings" |
| **Unit test** | Automatic code checks that a function gives the expected answer | "Every demo number is pinned by an automated test" |
| **Next.js / Vercel / MongoDB Atlas** | The web framework, the hosting, the database | — |
| **IMAP / SMTP** | Protocols to read (IMAP) and send (SMTP) email | "Faisla sends RFQs by SMTP and reads replies by IMAP every 10 seconds" |

---

## Sources

Pakistani law and Islamic finance (also in [ISLAMIC_FINANCE.md](ISLAMIC_FINANCE.md)):

- 26th Amendment, riba before 1 Jan 2028: [Arab News](https://www.arabnews.pk/pakistan/pakistan-sets-jan-1-2028-deadline-to-eliminate-riba-or-interest-from-country-2576082), [National Assembly summary](https://na.gov.pk/uploads/documents/67a496ea68bb9_790.pdf)
- Federal Shariat Court, 31 Dec 2027: [Dawn 2022](https://www.dawn.com/news/amp/1687367), [Business Recorder](https://www.brecorder.com/news/amp/40170246)
- Diminishing Musharakah and Ijarah for machinery: [Meezan Bank commercial banking](https://www.meezanbank.com/commercial-banking/), [SBP Diminishing Musharakah standard, IBD Circular 02/2013](https://www.sbp.org.pk/circulars/ibd-circular-no-02-of-2013), [DIB Pakistan: KIBOR + agreed basis points](https://www.dibpak.com/?p=340)
- Ijarah takaful by the owner: [Bank Alfalah FAQ](https://www.bankalfalah.com/islamic-premier/consumer-banking/alfalah-islamic-auto-finance/faqs)
- AAOIFI standards adopted by SBP: [SBP 2010](https://www.sbp.org.pk/ibd/2010/C1.htm), [SBP compendium IFPD 07/2024](https://www.sbp.org.pk/ifpd/2024/C7.htm)
- Late payment to charity: [Bank of Khyber](https://www.bok.com.pk/sites/default/files/2026-04/Islamic%20Banking%20Products%20and%20their%20difference%20with%20Conventional%20Banking%20....docx)
- Deferred-price sale permissible: [IIFA Resolution 51](https://iifa-aifi.org/en/32398.html), [Usmani via islamqa.org](https://islamqa.org/hanafi/daruliftaa/7738/murabaha-house-financing-when-deferred-payments-are-not-fixed/)
- Islamic LTFF, "3% less than the policy rate": [ABL export finance](https://www.abl.com/business-banking/trade-services/export-finances/), [SBP circular linking LTFF to the policy rate (2022)](https://www.sbp.org.pk/circulars/ihsmefd-circular-no-11-of-2022), [spread cut to 3%](https://www.brecorder.com/news/40217364)
- LTFF eligibility and tenors: [Bank AL Habib LTFF](https://www.bankalhabib.com/long-term-financing-facility-ltff-for-plant-and-machinery)
- Islamic banks' share of financing (38%): [SBP Islamic Banking Bulletin, Dec 2025](https://www.sbp.org.pk/assets/document/publications/Islamic_Banking_Bulletin_December_2025.pdf)

Rates:

- Policy rate 11.5% (set 28 Apr 2026, held 14 Sep 2026): [SBP](https://www.sbp.org.pk/dmmd/2026/C2.htm), [ARY](https://arynews.tv/sbp-retains-policy-rate-at-11-5-percent)
- KIBOR: [SBP KIBOR 4 Sep 2026](https://www.sbp.org.pk/assets/document/kibor-rates-04-september-2026.pdf), [SBP rates sheet](https://www.sbp.org.pk/ecodata/sir.pdf)

Tax:

- Initial allowance, depreciation rates, lease rentals: [PwC Pakistan corporate deductions](https://taxsummaries.pwc.com/pakistan/corporate/deductions)
- Corporate tax 29%: [PwC Pakistan corporate income tax](https://taxsummaries.pwc.com/Pakistan/Corporate/Taxes-on-corporate-income)
- Initial allowance excludes used plant: [pkrevenue](https://pkrevenue.com/initial-allowance-deduction-under-updated-ito-2001/)

Context:

- 82% of SMEs reported cash-flow problems (2020): [SMEDA–ADBI report](https://smeda.org/phocadownload/Research_Publications/SMEDA%20-%20ADBI%20Report%20on%20Impact%20of%20COVID-19%20on%20SMEs.pdf)
- US$5.7 trillion MSME finance gap: [SME Finance Forum](https://www.smefinanceforum.org/news/11526737)
