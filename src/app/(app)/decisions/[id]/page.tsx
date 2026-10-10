// One decision's workspace: the six-step flow, autosaved through StoreProvider.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DecisionWorkspace from "@/components/decisions/decision-workspace";
import { requireUser } from "@/lib/auth/session";
import { getCompany, getDecision } from "@/lib/server/repo";
import { StoreProvider } from "@/lib/store";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await requireUser();
  const decision = await getDecision(user.companyId, (await params).id);
  return { title: decision ? `${decision.title} — Faisla` : "Decision — Faisla" };
}

export default async function DecisionPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const [decision, company] = await Promise.all([getDecision(user.companyId, id), getCompany(user.companyId)]);
  if (!decision || !company) notFound();
  const step = (await searchParams).step;
  return (
    // Keyed by id so switching decisions starts a fresh store.
    <StoreProvider key={decision.id} company={company} decision={decision}>
      <DecisionWorkspace initialStep={typeof step === "string" ? step : undefined} />
    </StoreProvider>
  );
}
