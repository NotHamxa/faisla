import AppHeader from "@/components/AppHeader";
import ComparisonTable from "@/components/ComparisonTable";
import MarketCard from "@/components/MarketCard";
import MemoPanel from "@/components/MemoPanel";
import ProfileForm from "@/components/ProfileForm";
import QuotationStep from "@/components/QuotationStep";
import ReputationCard from "@/components/ReputationCard";
import SupplierPanel from "@/components/SupplierPanel";

function Step({ n, title, sub, children }: { n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
          {n}
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Should you buy it, and how should you pay?</h1>
          <p className="max-w-2xl text-muted">
            Upload a supplier&apos;s quotation. Faisla checks the price, finds better offers, and compares every way to
            pay. <span className="font-medium text-ink">AI reads, code calculates, you confirm.</span>
          </p>
        </div>

        <Step n={1} title="Your company" sub="Cash, costs and tax: the numbers every decision depends on.">
          <ProfileForm />
        </Step>

        <Step n={2} title="Upload the quotation" sub="AI reads the photo; you check every field.">
          <QuotationStep />
        </Step>

        <Step n={3} title="Is the price fair? Is the supplier safe?" sub="Web prices, a benchmark, and what other buyers say.">
          <div className="grid gap-4 lg:grid-cols-2">
            <MarketCard />
            <ReputationCard />
          </div>
        </Step>

        <Step n={4} title="Get competing offers" sub="Faisla emails other suppliers and reads their replies.">
          <SupplierPanel />
        </Step>

        <Step n={5} title="Compare every way to pay" sub="Cash, installments, bank loan, SBP LTFF: before and after tax.">
          <ComparisonTable />
        </Step>

        <Step n={6} title="Decide and act" sub="A one-page memo from the code's numbers, and a term-sheet request to the bank.">
          <MemoPanel />
        </Step>
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Faisla · Team CodeStorm · AICON&apos;26. Demo company, benchmark, reviews and supplier contacts are simulated.
      </footer>
    </>
  );
}
