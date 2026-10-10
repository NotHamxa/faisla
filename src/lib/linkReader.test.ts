import { describe, expect, it } from "vitest";
import { buildLinkResult, checkLinkUrl, htmlToText, isPrivateAddress, linkHash, linkPageProblem, NOTE_NO_PRICE } from "./linkReader";
import type { SpecRequirement } from "./types";

const REQS: SpecRequirement[] = [
  { label: "Core i9", mustHave: true, anyOf: ["i9", "core i9", "ultra 9"], noneOf: ["i5", "i7"] },
  { label: "RTX 4050", mustHave: true, anyOf: ["rtx 4050", "4050"], noneOf: [] },
];
const URL1 = "https://www.czone.com.pk/laptops-hp-omen-16-i9-13900hx-rtx-4050-p.aspx";
const page = {
  title: "HP Omen 16 Core i9-13900HX RTX 4050 Price in Pakistan",
  text: "HP Omen 16 Gaming Laptop. Core i9-13900HX, 16GB, 1TB SSD, RTX 4050 6GB. Price: Rs. 4,89,999. Old price Rs. 5,20,000. In stock.",
};
const read = { store: "Czone", title: "HP Omen 16", model: "HP Omen 16", pricePkr: 489_999, condition: "new" as const };

describe("SSRF guard", () => {
  it("accepts public http(s) links", () => {
    expect(checkLinkUrl(URL1).ok).toBe(true);
    expect(checkLinkUrl("czone.com.pk/some-product").ok).toBe(true); // scheme added
  });

  it("refuses other schemes, credentials, odd ports, localhost and private IPs", () => {
    for (const bad of [
      "file:///etc/passwd",
      "ftp://example.com/x",
      "javascript:alert(1)",
      "http://localhost:3000/api/decisions",
      "http://127.0.0.1/",
      "http://10.0.0.5/admin",
      "http://192.168.1.1/",
      "http://172.20.0.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
      "http://[fd00::1]/",
      "http://user:pass@example.com/",
      "http://example.com:6379/",
      "http://intranet/",
      "http://printer.local/",
      "not a url at all",
    ]) {
      expect(checkLinkUrl(bad).ok, bad).toBe(false);
    }
  });

  it("classifies resolved addresses", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("104.16.1.1")).toBe(false);
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("100.64.1.1")).toBe(true);
    expect(isPrivateAddress("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });

  it("search and video links are refused before fetching", () => {
    expect(linkPageProblem("https://www.daraz.pk/catalog/?q=gaming+pc")).toMatch(/search or category/);
    expect(linkPageProblem("https://www.youtube.com/watch?v=x")).toMatch(/video/);
    expect(linkPageProblem(URL1)).toBeNull();
  });
});

describe("page text", () => {
  it("strips scripts and tags, keeps the title and PKR structured price", () => {
    const html = `<html><head><title>Omen 16 &amp; more</title><meta property="og:title" content="HP Omen 16 i9">
      <script type="application/ld+json">{"@type":"Product","offers":{"price":"489999","priceCurrency":"PKR"}}</script>
      <style>.x{}</style></head><body><h1>HP Omen 16</h1><script>var p=1;</script><p>Rs.&nbsp;4,89,999</p></body></html>`;
    const { title, text } = htmlToText(html);
    expect(title).toBe("HP Omen 16 i9");
    expect(text).toContain("Price: PKR 489999");
    expect(text).toContain("Rs. 4,89,999");
    expect(text).not.toContain("var p");
    expect(text).not.toContain(".x{}");
  });
});

describe("buildLinkResult (code checks the AI read)", () => {
  it("price written on the page + specs present → option and offer", () => {
    const r = buildLinkResult({ url: URL1, page, read, qty: 2, requirements: REQS });
    expect(r.option?.unitPrice).toBe(489_999);
    expect(r.option?.specStatus).toBe("matched");
    expect(r.option?.seller).toBe("Czone");
    expect(r.option?.fromLink).toBe(true);
    expect(r.offer?.id).toBe(`offer-link-${linkHash(URL1)}`);
    expect(r.offer?.source).toBe("web");
    expect(r.offer?.sourceLink).toBe(URL1);
    expect(r.offer?.qty).toBe(2);
    expect(r.offer?.total).toBe(979_998);
    expect(r.note).toBeUndefined();
  });

  it("a price that is not written on the page is refused", () => {
    const r = buildLinkResult({ url: URL1, page, read: { ...read, pricePkr: 450_000 }, qty: 1 });
    expect(r).toEqual({ option: null, offer: null, note: NOTE_NO_PRICE });
    expect(buildLinkResult({ url: URL1, page, read: { ...read, pricePkr: null }, qty: 1 }).option).toBeNull();
  });

  it("keeps the owner's link but says when it contradicts the specs; uses the given offer id", () => {
    const i5 = { title: "Dell Core i5 RTX 4050", text: "Core i5 12450H, RTX 4050. Price Rs 2,99,000" };
    const r = buildLinkResult({ url: URL1, page: i5, read: { ...read, pricePkr: 299_000 }, qty: 1, requirements: REQS, offerId: "offer-x" });
    expect(r.option?.specStatus).toBe("mismatch");
    expect(r.offer?.id).toBe("offer-x");
    expect(r.note).toMatch(/doesn't seem to match/);
  });

  it("same link → same id", () => {
    expect(linkHash(URL1)).toBe(linkHash(`${URL1}#reviews`));
    expect(linkHash(URL1)).not.toBe(linkHash(URL1 + "x"));
  });
});
