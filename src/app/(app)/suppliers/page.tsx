// Supplier directory: every supplier seen across the company's decisions, merged by name.
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listDecisions } from "@/lib/server/repo";
import { buildSupplierDirectory } from "@/components/suppliers/directory";
import { SupplierDirectory } from "@/components/suppliers/supplier-directory";

export const metadata: Metadata = { title: "Suppliers · Faisla" };

export default async function SuppliersPage() {
  const user = await requireUser();
  const suppliers = buildSupplierDirectory(await listDecisions(user.companyId));

  return (
    <div className="space-y-6">
      <div className="space-y-1 border-b border-foreground/80 pb-4">
        <h1 className="text-[1.75rem] leading-tight font-bold">Suppliers</h1>
        <p className="text-sm text-muted-foreground">
          Everyone who quoted, was sent an RFQ or replied, across all your decisions. Reputation is scored by code
          from reviews; it flags risks but never changes the money figures.
        </p>
      </div>
      <SupplierDirectory suppliers={suppliers} />
    </div>
  );
}
