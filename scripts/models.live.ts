// Benchmarks cheap OpenAI models on Faisla's real tasks through the real routes:
// quotation photo extraction (vision), Roman Urdu reply reading (fast), decision memo (write).
// Prints accuracy and measured cost per model. Needs OPENAI_API_KEY and scripts/quotation.png.
import fs from "node:fs";
import { test } from "vitest";
import { POST as extractPost } from "@/app/api/extract/route";
import { POST as memoPost } from "@/app/api/memo/route";
import { usageLog } from "@/lib/ai";
import { INTERNAL_HEADER, INTERNAL_TOKEN } from "@/lib/auth/api";

const internal = { [INTERNAL_HEADER]: INTERNAL_TOKEN };
import { demoQuotation } from "@/lib/demoData";
import { extractReply } from "@/lib/replyParser";
import { demoDecision } from "@/lib/__fixtures__/demoDecision";
import type { MemoResult, Quotation } from "@/lib/types";

// $ per 1M tokens (input, output), OpenAI standard tier.
const PRICES: Record<string, [number, number]> = {
  "gpt-5-nano": [0.05, 0.4],
  "gpt-4.1-nano": [0.1, 0.4],
  "gpt-6-luna": [0.1, 0.5],
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-5.6-luna": [0.2, 1.2],
  "gpt-5-mini": [0.25, 2.0],
  "gpt-4.1-mini": [0.4, 1.6],
};
const MODELS = (process.env.BENCH_MODELS?.split(",") ?? Object.keys(PRICES)).filter((m) => PRICES[m]);

function costSince(start: number): { usd: number; tokens: string } {
  const calls = usageLog.slice(start);
  let usd = 0;
  let inT = 0;
  let outT = 0;
  let reason = 0;
  for (const c of calls) {
    const [pi, po] = PRICES[c.model] ?? [0, 0];
    usd += (c.inputTokens * pi + c.outputTokens * po) / 1e6;
    inT += c.inputTokens;
    outT += c.outputTokens;
    reason += c.reasoningTokens;
  }
  return { usd, tokens: `${inT} in / ${outT} out${reason ? ` (${reason} reasoning)` : ""}` };
}

function scoreQuotation(q: Quotation | null): { score: number; misses: string[] } {
  if (!q) return { score: 0, misses: ["no output"] };
  const item = q.items?.[0];
  const checks: [string, boolean][] = [
    ["supplier", /al-?noor/i.test(q.supplierName ?? "")],
    ["qty", item?.qty === 80],
    ["unitPrice", item?.unitPrice === 75_000],
    ["lineTotal", item?.lineTotal === 60_00_000],
    ["model", /jack\s*f5/i.test(item?.model ?? item?.description ?? "")],
    ["printedTotal", q.printedTotal === 60_00_000],
    ["cashDiscount", q.cashDiscountPct === 8],
    ["months", q.installmentMonths === 12],
    ["installment", q.installmentAmount === 5_00_000],
    ["firstOnDelivery", q.firstInstallmentOnDelivery === false],
    ["markupClaim", q.markupClaimedPct === 0],
    ["validity", q.validityDays === demoQuotation.validityDays],
  ];
  const misses = checks.filter(([, ok]) => !ok).map(([k]) => k);
  return { score: checks.length - misses.length, misses };
}

const REPLIES = [
  { body: "Bhai, 80 machines 67 hazar per unit final, delivery 10 din, 1 saal warranty", unit: 67_000, days: 10, warranty: 12 },
  {
    body: "Assalam o alaikum. Jack F5 ki 80 units ka total 53 lakh 60 hazar banega, 30% advance baqi delivery pe. Delivery 2 hafte, warranty 6 mahine.",
    unit: 67_000,
    days: 14,
    warranty: 6,
  },
];

const rows: string[] = [];

test("benchmark", async () => {
  const image = fs.readFileSync("scripts/quotation.png").toString("base64");
  for (const model of MODELS) {
    process.env.OPENAI_MODEL_VISION = model;
    process.env.OPENAI_MODEL_FAST = model;
    process.env.OPENAI_MODEL_WRITE = model;

    // Vision: the printed quotation.
    let start = usageLog.length;
    let t = Date.now();
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(image, "base64")], { type: "image/png" }), "quotation.png");
    const exRes = await extractPost(new Request("http://localhost/api/extract", { method: "POST", body: form, headers: internal }));
    const exBody = (await exRes.json()) as { quotation?: Quotation; source?: string };
    const q = scoreQuotation(exBody.source === "ai" ? (exBody.quotation ?? null) : null);
    const exCost = costSince(start);
    rows.push(`${model} | vision | ${q.score}/12 ${q.misses.length ? "miss: " + q.misses.join(",") : ""} | $${exCost.usd.toFixed(5)} | ${exCost.tokens} | ${Date.now() - t}ms`);

    // Fast: Roman Urdu replies, AI result only.
    start = usageLog.length;
    t = Date.now();
    let ok = 0;
    const notes: string[] = [];
    for (const r of REPLIES) {
      const x = await extractReply({ body: r.body, referenceUnitPrice: demoQuotation.items[0].unitPrice });
      const good = x.source === "ai" && x.unitPrice === r.unit && x.deliveryDays === r.days && x.warrantyMonths === r.warranty;
      if (good) ok++;
      else notes.push(`[${x.source} ${x.unitPrice}/${x.deliveryDays}d/${x.warrantyMonths}m]`);
    }
    const rpCost = costSince(start);
    rows.push(`${model} | reply | ${ok}/${REPLIES.length} ${notes.join(" ")} | $${rpCost.usd.toFixed(5)} | ${rpCost.tokens} | ${Date.now() - t}ms`);

    // Write: memo must come from the LLM and pass the number check.
    start = usageLog.length;
    t = Date.now();
    const mRes = await memoPost(
      new Request("http://localhost/api/memo", { method: "POST", body: JSON.stringify({ decision: demoDecision }), headers: internal }),
    );
    const memo = (await mRes.json()) as MemoResult;
    const mCost = costSince(start);
    const verdict = memo.source === "llm" && memo.numberCheck.passed ? `pass (attempts ${memo.numberCheck.attempts})` : `FAIL → ${memo.source}`;
    rows.push(`${model} | memo | ${verdict} | $${mCost.usd.toFixed(5)} | ${mCost.tokens} | ${Date.now() - t}ms`);
    fs.writeFileSync("scripts/bench-results.txt", rows.join("\n") + "\n"); // partial results survive a crash
  }
  const total = costSince(0);
  const report = `MODEL | TASK | RESULT | COST | TOKENS | TIME\n${rows.join("\n")}\n\nTotal benchmark spend: $${total.usd.toFixed(4)}\n`;
  fs.writeFileSync("scripts/bench-results.txt", report);
});
