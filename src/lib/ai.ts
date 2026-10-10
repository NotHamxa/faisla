// The only place that talks to the LLM. Reads documents and writes prose; never does maths.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const MODEL = process.env.FAISLA_MODEL ?? "claude-opus-5-5";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.DEMO_MODE !== "1";
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
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

// Structured extraction: returns parsed, schema-valid output or null (caller falls back to the owner).
export async function aiJson<S extends z.ZodType>(
  schema: S,
  opts: AiJsonOptions,
): Promise<z.infer<S> | null> {
  if (!aiEnabled()) return null;
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of opts.images ?? []) {
    if (img.mediaType === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: img.base64 },
      });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      });
    }
  }
  content.push({ type: "text", text: opts.prompt });

  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      system: opts.system,
      output_config: { format: zodOutputFormat(schema), effort: opts.effort ?? "low" },
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return null;
    const parsed = schema.safeParse(response.parsed_output);
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
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      system: opts.system,
      output_config: { effort: opts.effort ?? "low" },
      messages: [{ role: "user", content: opts.prompt }],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    return text || null;
  } catch (error) {
    logAiError(error);
    return null;
  }
}

function logAiError(error: unknown) {
  if (error instanceof Anthropic.RateLimitError) console.error("[ai] rate limited");
  else if (error instanceof Anthropic.AuthenticationError) console.error("[ai] invalid API key");
  else if (error instanceof Anthropic.APIError) console.error(`[ai] API error ${error.status}: ${error.message}`);
  else console.error("[ai] request failed", error);
}
