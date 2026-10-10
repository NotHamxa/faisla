// Financing: SBP reference rates and the company's loan options (bank, LTFF) used in every comparison.
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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Financing</h1>
        <p className="text-sm text-muted-foreground">
          The loan options every decision compares against cash and supplier installments. Changes apply to new
          comparisons.
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
