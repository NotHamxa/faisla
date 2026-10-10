// Demo supplier directory with contact emails taken from env, so RFQs land in team test inboxes.
// SUPPLIER_B_EMAIL / SUPPLIER_C_EMAIL win; else TEST_INBOX; else the demo placeholder.
import { demoSuppliers } from "./demoData";
import type { Supplier } from "./types";

const EMAIL_ENV = ["SUPPLIER_B_EMAIL", "SUPPLIER_C_EMAIL"];

export function resolveDemoSuppliers(): Supplier[] {
  return demoSuppliers.map((s, i) => ({
    ...s,
    email: process.env[EMAIL_ENV[i] ?? ""] || process.env.TEST_INBOX || s.email,
  }));
}

export function sameSupplier(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return Boolean(a && b) && norm(a) === norm(b);
}
