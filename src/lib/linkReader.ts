// "Paste your own link": a product page the owner found → one option and one offer.
// The page is fetched by Tavily Extract when available (our server never opens the URL), otherwise by a
// guarded fetch (http/https only, public addresses only, re-checked on every redirect, 10 s, size cap).
// The AI only reads seller, title, price and condition; code checks the price is written on the page
// and the owner's specs (lib/sourcing.ts checkRequirements). Totals are qty × unit price, in code.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parseAmounts } from "./replyParser";
import { checkRequirements, cleanStoreName, listingUrlProblem, optionToOffer } from "./sourcing";
import type { Offer, SourcedOption, SpecRequirement, SpecStatus } from "./types";

export const LINK_TEXT_CAP = 8000;
const MAX_HTML_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export type LinkResponse = { option: SourcedOption | null; offer: Offer | null; note?: string };

/* ---------- SSRF guard ---------- */

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

// Loopback, private, link-local, carrier-grade NAT, multicast and reserved ranges (IPv4 and IPv6).
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v !== 6) return true; // not an IP: treat as unsafe
  const x = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
  if (mapped) return ipv4Private(mapped[1]);
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(x)) return true; // mapped IPv4 in hex form: refuse
  return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || /^ff/.test(x) || x.startsWith("64:ff9b:");
}

// http/https, no credentials, default ports, a public host name or public IP. Returns the URL or a note.
export function checkLinkUrl(raw: string): { ok: true; url: URL } | { ok: false; note: string } {
  const bad = { ok: false as const, note: "That doesn't look like a web link. Paste the full address, starting with https://" };
  const text = raw.trim();
  if (!text || text.length > 2000) return bad;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return bad;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return bad;
  if (u.username || u.password) return bad;
  if (u.port && u.port !== "80" && u.port !== "443") return { ok: false, note: "Only normal web links (http or https) can be read." };
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) return { ok: false, note: "That link points to a private address and can't be read." };
    return { ok: true, url: u };
  }
  if (!host.includes(".") || /(^|\.)(localhost|local|internal|lan|home|intranet|corp|localdomain)$/.test(host)) {
    return { ok: false, note: "That link points to a private address and can't be read." };
  }
  return { ok: true, url: u };
}

// Every address the host resolves to must be public (blocks DNS names that point inside the network).
export async function resolvesPublic(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return !isPrivateAddress(host);
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

/* ---------- Page text ---------- */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", ndash: "-", mdash: "-" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function metaContent(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0];
  const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return content ? decodeEntities(content).trim() : null;
}

// HTML → title + readable text. Structured price data written by the shop (meta tags, JSON-LD in PKR) is
// kept as a line of text, since many shops render the visible price with scripts.
export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities(metaContent(html, "og:title") ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const extra: string[] = [];
  const description = metaContent(html, "og:description") ?? metaContent(html, "description");
  if (description) extra.push(description);
  const metaPrice = metaContent(html, "product:price:amount") ?? metaContent(html, "og:price:amount") ?? metaContent(html, "price");
  const metaCurrency = metaContent(html, "product:price:currency") ?? metaContent(html, "og:price:currency") ?? metaContent(html, "priceCurrency");
  if (metaPrice && /pkr|rs/i.test(metaCurrency ?? "")) extra.push(`Price: PKR ${metaPrice}`);
  for (const block of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const json = block[1];
    if (!/"priceCurrency"\s*:\s*"PKR"/i.test(json)) continue;
    const price = /"(?:price|lowPrice)"\s*:\s*"?(\d[\d,]*(?:\.\d+)?)/i.exec(json)?.[1];
    if (price) extra.push(`Price: PKR ${price}`);
  }
  const body = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return { title, text: [...extra, body].join("\n").slice(0, LINK_TEXT_CAP) };
}

// Guarded fetch: every hop re-validated (scheme, host, public DNS), browser-like agent, 10 s, size cap.
export async function safeFetchPage(start: URL): Promise<{ title: string; text: string } | null> {
  let url = start;
  const deadline = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const checked = checkLinkUrl(url.toString());
    if (!checked.ok || !(await resolvesPublic(url.hostname))) return null;
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: deadline,
        headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-PK,en;q=0.9" },
      });
    } catch {
      return null;
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return null;
      try {
        url = new URL(next, url);
      } catch {
        return null;
      }
      continue;
    }
    if (!res.ok || !/html|text\/plain/i.test(res.headers.get("content-type") ?? "text/html")) return null;
    const html = await readCapped(res);
    return html ? htmlToText(html) : null;
  }
  return null;
}

async function readCapped(res: Response): Promise<string | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } catch {
    if (!size) return null;
  } finally {
    reader.cancel().catch(() => {});
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

/* ---------- Building the option and offer (pure) ---------- */

// Short stable id for a URL (FNV-1a 32-bit), so pasting the same link twice gives the same offer id.
export function linkHash(url: string): string {
  let h = 0x811c9dc5;
  for (const ch of url.trim().replace(/#.*$/, "")) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export type LinkRead = {
  store: string | null;
  title: string | null;
  model: string | null;
  pricePkr: number | null;
  condition: "new" | "used" | "refurbished" | "unknown";
};

export const NOTE_NO_PRICE = "Couldn't read a price on that page. Enter it yourself.";

export function buildLinkResult(input: {
  url: string;
  page: { title: string; text: string };
  read: LinkRead;
  qty: number;
  requirements?: SpecRequirement[] | null;
  offerId?: string | null;
}): LinkResponse {
  const { url, page, read, qty } = input;
  const price = read.pricePkr;
  if (price == null || !(price > 0)) return { option: null, offer: null, note: NOTE_NO_PRICE };
  // Code check: the price must be an amount written on the page, not something the AI made up.
  const written = parseAmounts(`${page.title}\n${page.text}`).map((a) => a.value);
  if (!written.some((v) => Math.abs(v - price) <= 1)) return { option: null, offer: null, note: NOTE_NO_PRICE };

  const title = (page.title || read.title || "").replace(/\s+/g, " ").trim().slice(0, 160);
  const check = checkRequirements(title, page.text, input.requirements ?? undefined);
  // A page the owner chose is never dropped: a contradicted spec is shown as "doesn't match",
  // a spec not written anywhere as "couldn't check".
  const specStatus: SpecStatus = check.conflicts.length ? "mismatch" : check.missing.length ? "unverified" : "matched";
  const hash = linkHash(url);
  const used = read.condition === "used" || read.condition === "refurbished";
  const option: SourcedOption = {
    id: `opt-link-${hash}`,
    seller: cleanStoreName(read.store, url),
    item: read.title?.trim().slice(0, 80) || title || "Product",
    model: read.model?.trim() || null,
    title: title || read.title?.trim() || url,
    unitPrice: Math.round(price),
    condition: read.condition === "new" ? "new" : "unknown",
    exactModel: specStatus === "matched",
    url,
    contactEmail: null,
    contactPhone: null,
    simulated: false,
    specStatus,
    ...(check.missing.length ? { missingSpecs: check.missing } : {}),
    fromLink: true,
  };
  const offer: Offer = {
    ...optionToOffer(option, qty, 0),
    id: input.offerId || `offer-link-${hash}`,
    source: "web",
    sourceLink: url,
    summary: `Link added by you: ${option.title}`,
  };
  const notes = [
    used && `The page says this is ${read.condition}.`,
    specStatus === "mismatch" && `This page doesn't seem to match what you asked (${check.conflicts.slice(0, 3).join(", ")}).`,
    specStatus === "unverified" && `Couldn't check: ${check.missing.join(", ")}.`,
  ].filter(Boolean);
  return { option, offer, ...(notes.length ? { note: notes.join(" ") } : {}) };
}

// A search, category or video link never shows one price: ask for the product page instead.
export function linkPageProblem(url: string): string | null {
  const problem = listingUrlProblem(url);
  if (!problem) return null;
  return problem === "video or social post"
    ? "That's a video or social post. Paste the shop's product page instead."
    : "That looks like a search or category page. Open the product itself and paste its link.";
}
