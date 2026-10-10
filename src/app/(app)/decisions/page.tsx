// Decisions list: every purchase decision of the signed-in user's company, newest first.
import type { Metadata } from "next";
import { Suspense } from "react";
import DecisionsView from "@/components/decisions/decisions-view";
import { summarizeDecision } from "@/components/decisions/summary";
import { requireUser } from "@/lib/auth/session";
import { listDecisions } from "@/lib/server/repo";

export const metadata: Metadata = { title: "Decisions — Faisla" };

export default async function DecisionsPage() {
  const user = await requireUser();
  const decisions = (await listDecisions(user.companyId)).map(summarizeDecision);
  return (
    // DecisionsView reads ?new=1 via useSearchParams.
    <Suspense>
      <DecisionsView decisions={decisions} />
    </Suspense>
  );
}
