# Faisla demo video script

Team CodeStorm · AICON'26 Build With AI · Financial Operations

What this is for:

- The optional **project screen recording** (submission item 4).
- The **backup video** we play if a step fails during the live pitch.

Target length is 3:30 to 4:00. Live app: https://faisla-xi.vercel.app. Login: `demo@faisla.pk` / `faisla2026`.

Every number below was checked against `src/lib/finance.ts` with the demo data. Button names are copied from the UI.

---

## Before you record (10 minutes)

**Reset the demo account.** It is shared, so judges or teammates may have changed it.

1. Sign in once with **Sign in as demo**. The first sign-in creates the sample decisions.
2. Open **Settings** (left sidebar, bottom), then **Load demo company**. Check these values:
   - Cash in bank Rs 1,00,00,000
   - Monthly fixed costs Rs 35,00,000
   - Tax 29%, discount rate 15%
   - **We are an exporter** on
   - **Pay in full when we can afford it** off
   - Financing preference **Shariah-compliant only**

   Then click **Save profile**.
3. Open **Financing** and click **Reset to Islamic defaults** if any option was edited (then save if a save button lights up). Diminishing Musharakah and Ijarah should be 14.8%, Islamic LTFF 8.5%, 10% own share, 36 months, fee 0%.
4. Sign out, then sign back in so the recording starts on the login page.

**Warm the site up.** Vercel functions and the database sleep when idle. The first call after a pause can take 5 to 15 seconds.

- About 2 minutes before recording, do one full dry run: create a throwaway decision and click through every step. That wakes up every API route (extract, market, reviews, suppliers, RFQ, replies, decide, memo, bank email).
- Delete the throwaway decision afterwards, or just leave it.

**Screen setup.**

| Setting | Value |
| --- | --- |
| Resolution | 1920 × 1080, browser full screen (F11) or a maximised window |
| Browser zoom | 110% so table numbers are readable on a projector. Check the comparison table still fits |
| Browser | A clean Chrome profile or a guest window: no extensions, no bookmarks bar (Ctrl+Shift+B), no other tabs |
| Theme | Light (Settings → Appearance). It reads better on projectors |
| Notifications | Windows Focus assist on, Slack/WhatsApp closed, phone silent |
| Mouse | Move slowly. Pause on each number for about 1 second before you talk about it |
| Recorder | OBS or the Xbox Game Bar (Win+Alt+R), 30 fps, record system audio off, voice-over recorded separately or live with a headset |

**Quotation photo.** The strongest AI moment is the vision model reading a real photo. Before recording:

- Print `https://faisla-xi.vercel.app/demo/quotation` on A4 and photograph it with a phone (flat, good light). Or use `scripts/quotation.png` from the repo.
- Save the photo on the desktop so the file picker opens fast.

**If something is slow while recording.** Do not wait on camera. Pause the recorder, let the step finish, resume, and cut the gap in editing. If a step fails:

- **Quotation upload fails:** use **Demo → Use demo quotation** and switch to the "B" voice-over line in scene 4.
- **Market or reviews spin:** click **Re-check** once. The cached Jack F5 data answers instantly.
- **Price-request email fails:** the badge says "Asked (simulated)". That is fine. Keep going and use **Demo → Use demo reply**.
- **Memo says "Template memo used":** the AI draft failed the number check or the AI was down. The numbers are still right. Say "Faisla fell back to its template because the number check is strict", or re-record that scene.

---

## Scene-by-scene script

Timings are cumulative. VO = voice-over. Captions are short on-screen text added in editing (lower third).

| # | Time | On screen (exact clicks) | Voice-over | Caption |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:12 | Login page. Point at the **Demo account** box, click **Sign in as demo**. | "This is Faisla, a CFO in a box for small businesses in Pakistan. It helps an owner decide how to pay for a big purchase, Islamic finance first." | Faisla: a CFO in a box for SMEs |
| 2 | 0:12–0:20 | **Dashboard** loads. Hover over the tiles **Cash in bank**, **Cash left (months)**, **Money saved**, then the **Alerts** card. | "Hamza Garments is a fictional exporter in Faisalabad. One crore in the bank, thirty-five lakh of costs a month. The dashboard shows cash, how many months that cash lasts, and alerts." | Demo company: fictional, labelled "Demo data" |
| 3 | 0:20–0:35 | Top bar **New decision**. Type `80 × Jack F5 lockstitch machines`. Choose **I have a quotation**, click **Create decision**. | "Hamza wants 80 Jack F5 sewing machines. A supplier has sent a quotation. Sixty lakh rupees, or twelve installments at '0% markup'." | Start from a quotation, or describe what you need |
| 4 | 0:35–1:05 | Step **1 Quote**. Preferred: **Upload quotation photo**, pick the photo (fallback: **Demo → Use demo quotation**). Spinner "Reading the quotation…". The **Check the quotation** form opens with the badge **AI read this**. Scroll slowly: supplier, item (80 × Rs 75,000 = Rs 60,00,000), **Payment plan**: **Cash discount** 8%, **Installments** 12 × Rs 5,00,000. Pause on the amber warning under the installments. Open **More details** (right side says "Bank account saved"): totals, "Markup" claimed 0, bank details, and the green line **IBAN checksum OK**. | **A (photo):** "We take a phone photo of the paper quotation. AI vision reads every field: supplier, price, payment terms, even the bank account. The owner checks each field, because code then checks the maths. The IBAN passes its checksum. And look: twelve times five lakh is sixty lakh. That is four lakh eighty thousand more than the cash price. So the '0%' plan is not free." **B (demo button):** "In the live product AI vision reads a phone photo of this quotation. For speed we load the same quotation here. The owner checks every field, then code checks the maths…" (continue as A from "The IBAN passes"). | AI reads the photo. Code checks the maths. Owner confirms. |
| 5 | 1:05–1:10 | Click **Confirm quotation**. Toast "Quotation confirmed". Click **Continue to Price check**. | "Confirmed." | 12 × Rs 5,00,000 = Rs 60,00,000, Rs 4,80,000 more than cash |
| 6 | 1:10–1:35 | Step **2 Price check**. **Market price** card: badge **Overpriced**, headline **This price is about 9% above the market**, "Quoted Rs 75,000 each; others pay about Rs 68,700." Open **See prices**: Benchmark median Rs 68,700 ("Simulated benchmark (60 rows)"), Web median Rs 70,000 ("3 listings"), "~7% above the real web median". Hover over the real OLX links (Rs 79,000 and Rs 70,000, Lahore) and the Rs 63,000 dealer video. Then the **Reputation** card: Al-Noor **Red flags** (3 warranty complaints), Jack F5 **Good**. | "Is seventy-five thousand a fair price? Faisla checks the web. These are real OLX listings for new Jack F5s. AI reads the listings, code drops used and wrong-model machines, and the median is seventy thousand. The quote is about nine percent above market. Reviews: the machine is well rated, but this supplier has three warranty complaints. That is a red flag." | Real listings, real links. Code decides what counts. |
| 7 | 1:35–1:50 | **Continue to Other offers**. Click **Ask suppliers for prices**. Two suppliers appear, Madina Sewing Solutions (Lahore) and Karachi Garment Tech (Karachi), and both get a price request; badges show **Asked**. The line below says "Waiting for replies…". | "So Faisla gets competing quotes. It finds two other dealers, AI writes a request for quotation, and emails both. Emails only go to our team's test inboxes. Then it watches the inbox." | AI writes the RFQ. Faisla polls the inbox every 10 s. |
| 8 | 1:50–2:10 | Open **Demo → Use demo reply** (opens **Paste a reply**, fills "Bhai, 80 machines 67 hazar per unit final, delivery 10 din, 1 saal warranty"; supplier = Madina Sewing Solutions). Click **Read reply**. A card shows **New offer: Rs 67,000 each**, "80 units · Rs 53,60,000 total · delivery 10 days · warranty 12 months". **See email** shows the original Roman Urdu text. | "Suppliers here reply the way people really write: in Roman Urdu. 'Sixty-seven hazar per unit, delivery das din, ek saal warranty.' AI reads it, and a code parser checks the price against the words in the email. Supplier B: sixty-seven thousand a machine, fifty-three lakh sixty thousand in total." | Roman Urdu reply → offer: 80 × Rs 67,000 = Rs 53,60,000 |
| 9 | 2:10–2:30 | Open **Demo → Demo fraud email**. Toast "This email asks you to pay a different account". Scroll to the top: red **Payment-fraud warning: Al-Noor Industrial Machines**, badge **High risk**. Point at the two reasons shown (new IBAN differs from the account on file; "our bank account has changed"), open **Why** for the rest (account title "Imran Qureshi", gmail.com instead of alnoor-machines.pk). Point at "Do not pay…". | "Now the most common payment fraud in Pakistan: 'our bank account has changed, please pay today.' It looks like Supplier A, but code catches it. A different IBAN from the one on the quotation. Urgency language. A personal account name. And a Gmail address instead of the company domain. Payment is blocked until the owner calls the supplier on a number they already have." | Payment-fraud check: code rules, not AI |
| 10 | 2:30–3:05 | Step **4 Compare** (calculates by itself). Point at "Showing: **Shariah-compliant only**". The answer card: **Best way to pay: Islamic LTFF 8.5% with Madina Sewing Solutions**; **Saves vs the quote Rs 4,73,603** (hover the ? for Rs 5,79,103 before tax); **You pay** Rs 5,36,000 now + Rs 1,52,282 × 36 months; **Cash left 2.59** months (now 2.86); "The quote's plan really costs 16.9% a year." In the table, point at **A, deferred-price plan ("0%")** with **Paying later costs 16.9% a year** and the tag **Hidden cost**. Then **B, cash**: cash left 1.33, tag **Cheapest, low cash**. Open **How we worked this out**, click **Show calculation** on the "0%" row: "Effective yearly cost 16.86%"; break-even discount rate 8.8%. | "Now the decision. Code does every rupee of this, no AI. By default Faisla compares only Shariah-compliant ways to pay. The '0% markup' plan is a permissible deferred-price sale, but paying later costs sixteen point nine percent a year. Here is the calculation. Paying cash to Supplier B is the cheapest price, but it leaves only one point three months of costs in the bank. The winner is SBP's Islamic LTFF for exporters at eight and a half percent. It saves five point eight lakh against the '0%' plan, four point seven lakh after tax, and keeps two and a half months of costs in the bank." | Rs 5.8 lakh saved · Rs 4.7 lakh after tax · runway 2.59 vs 1.33 months |
| 11 | 3:05–3:15 | Still inside **How we worked this out**: **Stress test: KIBOR shift** slider, drag to **+2%**. Green "Recommendation unchanged: B, Islamic LTFF 8.5%". Diminishing Musharakah and Ijarah now 16.8%, installment 1,71,509. Drag back to 0%. | "What if rates rise two percent? Diminishing Musharakah and Ijarah reprice, but Islamic LTFF follows the SBP rate, so the answer holds." | KIBOR +2%: recommendation unchanged |
| 12 | 3:15–3:40 | Step **5 Decide**. The red line says **Bank request blocked: confirm Al-Noor Industrial Machines's account by phone first.** Click **Write decision memo**. The line "Every number checked against the calculation · Written by AI" appears; scroll the memo briefly. **Ask the bank for an offer** is disabled. Scroll to the top, tick **I confirmed this account by phone, on a number I already had**. The banner turns green. Click **Ask the bank for an offer**. Toast "Request sent…". The **Request sent to the bank** card shows **Sent**; **See email** shows the body and the installment-schedule attachment. | "AI writes the memo in plain words, and code checks every number in it against the calculation before the owner sees it. The term-sheet request to the Islamic bank is blocked until the owner confirms the account by phone. Confirmed. Now Faisla emails the bank's SME desk with the profit rate, takaful, late-payment charity and Shariah board questions, and a 36-month installment schedule." | AI writes. Code checks every number. Fraud check blocks payment. |
| 13 | 3:40–3:52 | **Settings**. Point at the **Financing preference** radios (**Shariah-compliant only** / **Islamic and conventional**) and the **Pay in full when we can afford it** switch. Do not change them on camera unless you have time (see the note below). | "The owner sets the rules. Islamic only, or conventional shown for comparison but never recommended. And if you'd rather buy outright, Faisla recommends cash whenever it still leaves two months of costs in the bank. Here it doesn't, so it still says finance." | Owner's rules: Islamic only by default · pay in full when cash allows |
| 14 | 3:52–4:00 | Back to **Compare**, or a title card with the impact numbers and the live link. | "One quotation photo. Five point eight lakh saved, cash kept, fraud stopped. Faisla. AI reads, code calculates, the owner decides." | faisla-xi.vercel.app · AI reads, code calculates, owner confirms |

**Optional scene 13b (+15 s, only if the video is short):**

1. Choose **Islamic and conventional**, click **Save profile**.
2. Go back to the decision's **Compare** tab. A notice says "Your company details changed". Click **Recalculate**.
3. Two rows appear with the badge **Conventional · interest-based** and the tag **Comparison only**: `B, conventional LTFF 8.5%` and `B, conventional loan 14.8%`. The recommendation stays **B, Islamic LTFF 8.5%**.
4. Switch back to **Shariah-compliant only** and save.

For **Pay in full when we can afford it**: in the deployed build at the time of writing, saving this switch does **not** show the "profile changed" notice (a pending change adds it). If no notice appears, click the quiet **Recalculate** link at the top right of Compare. The result stays Islamic LTFF, because paying cash leaves 1.33 months, below the 2-month safety line. (With Rs 2 crore of cash it would switch to **B, cash**.)

---

## Live pitch talk track (5 minutes, 4 speakers)

This follows the team deck `docs/Faisla-Presentation.pptx`: 9 slides, Problem → Data/Input → AI Component → Solution → Impact. Slide timings match the deck's speaker notes; the lines below are a short version of those notes, split across four speakers.

- **A** drives the laptop and opens the app on slide 4 if you do the live option.
- If a live step fails, say "here's the recording" and play this video from the matching scene: scene 10 for Compare, scene 9 for the fraud email.
- Rulebook check: the deck covers problem, why it matters, solution, where AI is used, how it works, impact, and what we built during AICON'26 (slide 8).

| Time | Speaker | Slide | What to say (short version) |
| --- | --- | --- | --- |
| 0:00–0:15 | **D** | 1 · Title | "Assalam-o-alaikum. We are Team CodeStorm, Financial Operations. This is Faisla, Urdu for 'decision': a CFO in a box for Pakistani small businesses, Islamic finance first." |
| 0:15–0:55 | **D** | 2 · Problem | "Meet Hamza Garments in Faisalabad: an exporter, one crore in the bank, thirty-five lakh a month in costs, no finance team. Hamza needs 80 machines. Supplier A quotes sixty lakh, '0% markup'. It isn't free: twelve times five lakh is four lakh eighty thousand more than the cash price. Owners keep making four mistakes: they don't see the cost of paying later, they miss cheap Islamic financing, they ignore tax, and they pay cash and run short for salaries." |
| 0:55–1:40 | **A** | 3 · AI Component | "The inputs are what an owner actually has: a quotation photo, supplier replies in Roman Urdu, web prices and reviews, the company's cash, and SBP rates. AI does the reading: the photo into fields, '67 hazar per unit' into a price, web listings and reviews, and it writes the emails and the memo. AI never does the maths. Code calculates every rupee, and the owner confirms. A price is kept only if it is written in the source, every memo number is checked, and fraud levels come from rules. A full decision costs about a fifth of a US cent in AI." |
| 1:40–2:30 | **B** (A drives if live) | 4 · Solution, or live: seeded decision "80 × Jack F5 lockstitch machines", **Compare** tab | "Here's Hamza's result. The quote is about 9% above our benchmark; real OLX listings put the median at seventy thousand. Supplier B replied in Roman Urdu at sixty-seven thousand. Then code compared every way to pay. One: the '0%' plan is a deferred-price sale, and paying later costs 16.9% a year. Two: Hamza is an exporter, so SBP's Islamic LTFF at 8.5% wins. Three: a 'new bank account, pay today' email is flagged: new IBAN, wrong account title, a Gmail address. Payment is blocked until Hamza confirms by phone." |
| 2:30–3:05 | **B** | 5 · Islamic finance first | "By default Faisla compares only Shariah-compliant options: Islamic LTFF, Ijarah, Diminishing Musharakah, and Murabaha as a preset, each with its correct tax treatment. Conventional loans appear only on request, labelled, never recommended. Why now? The 26th Amendment: riba out before 1 January 2028, and 38% of bank financing is already Islamic. And if an owner would rather not finance, one switch recommends paying in full whenever cash still covers two months of costs." |
| 3:05–3:40 | **C** | 6 · Impact | "One decision: Rs 5.8 lakh saved against the quoted plan, 4.7 lakh even after tax. Hamza keeps 2.59 months of costs in the bank; paying cash would leave 1.33. The fraud email is stopped before any money moves. This supports SDG 8.3, SME growth; 8.10, access to financial services; and 9.3, affordable credit for small industry." |
| 3:40–4:05 | **C** | 7 · Financial Operations fit and who pays | "It covers all five Financial Operations areas in one flow: planning, credit and risk, accounting automation, payments and fraud detection. SMEs pay a monthly plan, Islamic banks get clean, documented financing requests, and suppliers pay to be listed in comparisons." |
| 4:05–4:35 | **A** | 8 · What we built | "Everything here was built during AICON'26; the commit history starts on 10 October. The finance engine in pure TypeScript, nine AI tasks each followed by a code check, the fraud rules, the email loop, the app. The automated tests pin every number you saw. The company, supplier names and benchmark are simulated and labelled. The market prices and product reviews are real. We used AI coding assistants, as the rules allow." |
| 4:35–4:50 | **D** | 9 · Try it now | "Scan to try it; the demo login is on screen. Next: WhatsApp quotes, tracking payments after the decision, and Urdu. AI reads, code calculates, the owner decides. That's Faisla. Thank you." |

The deck's notes total about 4:50, leaving a few seconds of slack.

Q&A split: **B** takes finance and Shariah questions, **A** takes AI and tech, **C** takes fraud, business and impact, and **D** moderates and takes "what did you build". Answers are in [PROJECT_BRIEFING.md](PROJECT_BRIEFING.md) §14.

**Rules for the live run:**

- **One driver.** A shares the screen. The others talk and do not touch the laptop.
- **Pre-open the seeded decision.** Open "80 × Jack F5 lockstitch machines" on the **Compare** tab in one tab, and the dashboard in another, before you walk up. Live demo time is only the 50 seconds of slide 4. Show three things: the answer card (Best way to pay), the "0%" row's hidden-cost tag, and the fraud banner.
- **The seeded decision has no fraud email.** Before the pitch, open its **Other offers** step, then **Demo → Demo fraud email**. The red banner then sits at the top of every tab. Leave it unconfirmed.
- **Keep numbers short when speaking.** Say "5.8 lakh", "4.7 lakh", "16.9%", "8.5%", "2.59 versus 1.33 months". The exact rupee figures are on screen.
- **Don't promise what isn't built.** WhatsApp, Urdu UI and payment tracking are roadmap.
