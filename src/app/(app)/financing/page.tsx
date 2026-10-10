// Financing: Islamic-first preference, Islamic modes explained, SBP reference rates and the company's financing options.
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/server/repo";
import { StoreProvider } from "@/lib/store";
import { FinancingManager } from "@/components/financing/financing-manager";

export const metadata: Metadata = { title: "Financing · Faisla" };

export default async function FinancingPage() {
  const user = await requireUser();
  const company = await getCompany(user.companyId);

  return (
    <div className="space-y-6">
      <div className="space-y-1 border-b border-foreground/80 pb-4">
        <h1 className="text-[1.75rem] leading-tight font-bold">Financing</h1>
        <p className="text-sm text-muted-foreground">
          The Shariah-compliant financing every decision compares against cash and the supplier&apos;s deferred-price
          plan. Changes apply to new comparisons.
        </p>
      </div>
      {company ? (
        <StoreProvider company={company}>
          <FinancingManager />
        </StoreProvider>
      ) : (
        <p className="text-sm text-muted-foreground">Company profile not found. Sign out and sign in again.</p>
      )}
    </div>
  );
}
