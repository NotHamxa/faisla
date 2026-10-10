// POST /api/memo: decision → one-page memo. The AI writes prose from a facts list built by code;
// every number in its draft is checked against that list. Unknown numbers → retry (max 2) → template.
import { aiEnabled, aiText } from "@/lib/ai";
import { allowedNumbers, memoFacts, type MemoContext } from "@/lib/memoFacts";
import { comparisonTable, memoTemplate } from "@/lib/memoTemplate";
import { checkMemoNumbers } from "@/lib/numberCheck";
import type { DecideResult, FinancingOption, MemoResult, Offer, ReputationResult } from "@/lib/types";

export const maxDuration = 60;

type MemoRequest = {
  decision: DecideResult;
  reputations?: Record<string, ReputationResult>;
  offers?: Offer[]; // optional: adds qty / unit price facts
  financing?: FinancingOption[]; // optional: exact loan rates
};

const MAX_RETRIES = 2;

const SYSTEM = `You write one-page decision memos for the owner of a small Pakistani business (an SME owner, not a finance expert).
Plain, direct business English. Short sentences. No jargon without a one-line explanation.

Format: markdown only.
- Start with "# Decision memo: <company name>".
- Sections, in order: "## Recommendation", "## Why" (exactly 3 bullets), "## Comparison", "## Risks" (bullets), "## Next steps" (numbered list).
- Under "## Comparison", include the comparison table you are given exactly as written.

Numbers (strict, checked by code):
- Use ONLY the numbers in the facts list, written exactly as given (e.g. "Rs 49,87,935", "5.8 lakh", "16.9%", "2.59 months").
- Do not calculate, round, convert or add any other number. No years, no dates, no counts, no percentages that are not in the facts.
- If you need a number that is not in the facts, describe it in words instead.
- The supplier's "0%" claim may only appear inside quotation marks.`;

export async function POST(request: Request): Promise<Response> {
  let body: MemoRequest;
  try {
    body = (await request.json()) as MemoRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { decision, reputations } = body;
  if (!decision || !Array.isArray(decision.rows) || decision.rows.length === 0 || !decision.company) {
    return Response.json({ error: "decision with at least one row is required" }, { status: 400 });
  }

  const context: MemoContext = { offers: body.offers, financing: body.financing };
  const facts = memoFacts(decision, reputations, context);
  const allowed = allowedNumbers(facts);
  const template = () => memoTemplate(decision, reputations, context);

  if (!aiEnabled()) return Response.json(templateResult(template(), allowed, 0));

  const factsJson = JSON.stringify(
    facts.map((f) => (f.alt ? { fact: f.label, value: f.value, alsoWritten: f.alt } : { fact: f.label, value: f.value })),
    null,
    1,
  );
  const basePrompt = [
    "Write the decision memo from these facts. They come from tested finance code.",
    "Use ONLY these numbers, written exactly as given; do not calculate, round or add any other number.",
    "",
    "Facts (JSON):",
    factsJson,
    "",
    "Comparison table (copy exactly under ## Comparison):",
    comparisonTable(decision),
    reputations && Object.keys(reputations).length
      ? "\nList any red-flag or mixed supplier reviews under Risks; they do not change the money figures."
      : "",
  ].join("\n");

  let attempts = 0;
  let unknown: string[] = [];
  while (attempts <= MAX_RETRIES) {
    attempts += 1;
    const prompt =
      unknown.length === 0
        ? basePrompt
        : `${basePrompt}\n\nYour previous draft was rejected because it used numbers that are not in the facts: ${unknown.join(", ")}.\n` +
          "Rewrite the memo without them. Use only values from the facts, copied exactly, or say it in words.";
    const draft = await aiText({ system: SYSTEM, prompt, maxTokens: 4000 });
    if (!draft) break; // AI failed: use the template
    const memo = stripFence(draft);
    const check = checkMemoNumbers(memo, allowed);
    if (check.passed) {
      const result: MemoResult = { memo, numberCheck: { passed: true, unknownNumbers: [], attempts }, source: "llm" };
      return Response.json(result);
    }
    unknown = check.unknownNumbers;
    console.warn(`[memo] attempt ${attempts} rejected, unknown numbers: ${unknown.join(", ")}`);
  }

  return Response.json(templateResult(template(), allowed, attempts));
}

// The template is filled from the same formatted values, so it passes; the check is still run and reported.
function templateResult(memo: string, allowed: Set<string>, attempts: number): MemoResult {
  const check = checkMemoNumbers(memo, allowed);
  return { memo, numberCheck: { ...check, attempts }, source: "template" };
}

// Models sometimes wrap markdown in a ```markdown fence.
function stripFence(text: string): string {
  const fenced = text.trim().match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1].trim() : text.trim();
}
