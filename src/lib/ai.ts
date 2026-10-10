// The only place that talks to the LLM (OpenAI Responses API). Reads documents and writes prose; never does maths.
// Each call picks a tier so cheap models do the easy work; override per tier with env vars.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

export type AiTier = "vision" | "fast" | "write";

// Defaults chosen by scripts/models.live.ts: most accurate on our demo tasks, then cheapest.
const TIER_DEFAULTS: Record<AiTier, string> = {
  vision: "gpt-6-luna", // quotation photos: 12/12 fields, ~$0.0004 a photo
  fast: "gpt-4.1-nano", // replies, search results, reviews: fastest; the code parser cross-checks prices
  write: "gpt-6-luna", // RFQ email, memo: passes the number check first time
};

export function modelFor(tier: AiTier): string {
  const env = { vision: process.env.OPENAI_MODEL_VISION, fast: process.env.OPENAI_MODEL_FAST, write: process.env.OPENAI_MODEL_WRITE }[tier];
  return env || TIER_DEFAULTS[tier];
}

export function aiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) && process.env.DEMO_MODE !== "1";
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  client ??= new OpenAI();
  return client;
}

// Reasoning models (gpt-5.x and later, o-series) bill thinking as output tokens: keep effort at the floor.
function reasoningFor(model: string) {
  return /^(gpt-[5-9]|o\d)/.test(model) ? { reasoning: { effort: "low" as const } } : {};
}

// Token usage of recent calls, for cost checks (scripts/models.live.ts reads it).
export type AiUsage = { model: string; inputTokens: number; outputTokens: number; reasoningTokens: number };
export const usageLog: AiUsage[] = [];

function record(model: string, usage: OpenAI.Responses.ResponseUsage | undefined) {
  if (!usage) return;
  usageLog.push({
    model,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
  });
  if (usageLog.length > 200) usageLog.shift();
}

export type ImageInput = {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "application/pdf";
  base64: string;
};

type AiOptions = {
  system: string;
  prompt: string;
  images?: ImageInput[];
  maxTokens?: number;
  tier?: AiTier;
  model?: string; // explicit override (benchmarks)
};

function userContent(opts: AiOptions): OpenAI.Responses.ResponseInputMessageContentList {
  const content: OpenAI.Responses.ResponseInputMessageContentList = [];
  for (const img of opts.images ?? []) {
    const dataUrl = `data:${img.mediaType};base64,${img.base64}`;
    if (img.mediaType === "application/pdf") {
      content.push({ type: "input_file", filename: "quotation.pdf", file_data: dataUrl });
    } else {
      content.push({ type: "input_image", image_url: dataUrl, detail: "high" });
    }
  }
  content.push({ type: "input_text", text: opts.prompt });
  return content;
}

function resolveModel(opts: AiOptions): string {
  return opts.model ?? modelFor(opts.tier ?? (opts.images?.length ? "vision" : "fast"));
}

// Structured extraction: returns parsed, schema-valid output or null (caller falls back to the owner).
export async function aiJson<S extends z.ZodType>(schema: S, opts: AiOptions): Promise<z.infer<S> | null> {
  if (!aiEnabled()) return null;
  const model = resolveModel(opts);
  try {
    const response = await getClient().responses.parse({
      model,
      instructions: opts.system,
      input: [{ role: "user", content: userContent(opts) }],
      text: { format: zodTextFormat(schema, "result") },
      max_output_tokens: opts.maxTokens ?? 4000,
      ...reasoningFor(model),
    });
    record(model, response.usage);
    const parsed = schema.safeParse(response.output_parsed);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logAiError(model, error);
    return null;
  }
}

// Free text (emails, memo). Returns null when AI is unavailable so callers use a template.
export async function aiText(opts: AiOptions): Promise<string | null> {
  if (!aiEnabled()) return null;
  const model = resolveModel({ tier: "write", ...opts });
  try {
    const response = await getClient().responses.create({
      model,
      instructions: opts.system,
      input: [{ role: "user", content: userContent(opts) }],
      max_output_tokens: opts.maxTokens ?? 4000,
      ...reasoningFor(model),
    });
    record(model, response.usage);
    return response.output_text.trim() || null;
  } catch (error) {
    logAiError(model, error);
    return null;
  }
}

function logAiError(model: string, error: unknown) {
  if (error instanceof OpenAI.RateLimitError) console.error(`[ai:${model}] rate limited or out of credit`);
  else if (error instanceof OpenAI.AuthenticationError) console.error(`[ai:${model}] invalid API key`);
  else if (error instanceof OpenAI.APIError) console.error(`[ai:${model}] API error ${error.status}: ${error.message}`);
  else console.error(`[ai:${model}] request failed`, error);
}
