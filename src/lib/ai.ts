// The only place that talks to the LLM (OpenAI Responses API). Reads documents and writes prose; never does maths.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

export const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.5";

export function aiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) && process.env.DEMO_MODE !== "1";
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  client ??= new OpenAI();
  return client;
}

// Reasoning effort is only accepted by reasoning models (gpt-5.x and later, o-series).
function reasoningFor(effort: "low" | "medium" | "high") {
  return /^(gpt-[5-9]|o\d)/.test(MODEL) ? { reasoning: { effort } } : {};
}

export type ImageInput = {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "application/pdf";
  base64: string;
};

type AiJsonOptions = {
  system: string;
  prompt: string;
  images?: ImageInput[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
};

function userContent(opts: AiJsonOptions): OpenAI.Responses.ResponseInputMessageContentList {
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

// Structured extraction: returns parsed, schema-valid output or null (caller falls back to the owner).
export async function aiJson<S extends z.ZodType>(
  schema: S,
  opts: AiJsonOptions,
): Promise<z.infer<S> | null> {
  if (!aiEnabled()) return null;
  try {
    const response = await getClient().responses.parse({
      model: MODEL,
      instructions: opts.system,
      input: [{ role: "user", content: userContent(opts) }],
      text: { format: zodTextFormat(schema, "result") },
      max_output_tokens: opts.maxTokens ?? 16000,
      ...reasoningFor(opts.effort ?? "low"),
    });
    const parsed = schema.safeParse(response.output_parsed);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logAiError(error);
    return null;
  }
}

// Free text (emails, memo). Returns null when AI is unavailable so callers use a template.
export async function aiText(opts: AiJsonOptions): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    const response = await getClient().responses.create({
      model: MODEL,
      instructions: opts.system,
      input: [{ role: "user", content: userContent(opts) }],
      max_output_tokens: opts.maxTokens ?? 16000,
      ...reasoningFor(opts.effort ?? "low"),
    });
    return response.output_text.trim() || null;
  } catch (error) {
    logAiError(error);
    return null;
  }
}

function logAiError(error: unknown) {
  if (error instanceof OpenAI.RateLimitError) console.error("[ai] rate limited");
  else if (error instanceof OpenAI.AuthenticationError) console.error("[ai] invalid API key");
  else if (error instanceof OpenAI.APIError) console.error(`[ai] API error ${error.status}: ${error.message}`);
  else console.error("[ai] request failed", error);
}
