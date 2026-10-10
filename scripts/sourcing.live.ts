// One live "describe what I need" search through the real route (spends a little API credit).
// SOURCING_NEED=<need> picks the need; SOURCING_APPEND=1 appends to scripts/bench-results.txt.
import fs from "node:fs";
import { test } from "vitest";
import { POST } from "@/app/api/sourcing/route";
import { usageLog } from "@/lib/ai";
import { INTERNAL_HEADER, INTERNAL_TOKEN } from "@/lib/auth/api";

const internal = { [INTERNAL_HEADER]: INTERNAL_TOKEN };

test("live sourcing", async () => {
  const need = process.env.SOURCING_NEED ?? "2 industrial embroidery machines for my factory in Lahore, budget 20 lakh";
  const started = Date.now();
  const res = await POST(new Request("http://localhost/api/sourcing", { method: "POST", body: JSON.stringify({ need }), headers: internal }));
  const body = await res.json();
  const lines = [
    `=== ${need}`,
    `status ${res.status} cached=${body.cached} simulated=${body.simulated} ${Date.now() - started}ms`,
    `note: ${body.note ?? body.reason ?? ""}`,
    `request: ${JSON.stringify({ ...body.request, need: undefined })}`,
    `median: ${body.medianUnitPrice}`,
    ...(body.options ?? []).map(
      (o: Record<string, unknown>) => `- ${o.seller} | ${o.title} | Rs ${o.unitPrice} | ${o.specStatus ?? "-"} | ${o.condition} | ${o.url}`,
    ),
    `usage: ${JSON.stringify(usageLog)}`,
    "",
  ];
  if (process.env.SOURCING_APPEND === "1") fs.appendFileSync("scripts/bench-results.txt", lines.join("\n") + "\n");
  else fs.writeFileSync("scripts/bench-results.txt", lines.join("\n") + "\n");
});
