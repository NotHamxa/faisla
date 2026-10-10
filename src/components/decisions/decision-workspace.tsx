"use client";
// One decision's workspace: header (title, status, autosave, company context) and the five-step flow
// as tabs. The open step lives in the URL (?step=compare) so a refresh keeps your place.
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, CircleAlert, CloudCheck, Pencil, RotateCcw } from "lucide-react";
import ComparisonTable from "@/components/ComparisonTable";
import MarketCard from "@/components/MarketCard";
import MemoPanel from "@/components/MemoPanel";
import QuotationStep from "@/components/QuotationStep";
import ReputationCard from "@/components/ReputationCard";
import SupplierPanel from "@/components/SupplierPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPKR } from "@/lib/format";
import { type FaislaState, type SaveStatus, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DecisionStatusBadge } from "./status-badge";

const STEPS = [
  { value: "quotation", label: "Quotation", done: (s: FaislaState) => s.quotationConfirmed },
  { value: "market", label: "Price & reputation", done: (s: FaislaState) => s.market !== null },
  { value: "offers", label: "Competing offers", done: (s: FaislaState) => s.offers.length > 1 },
  { value: "compare", label: "Compare", done: (s: FaislaState) => s.decision !== null },
  { value: "decide", label: "Decide", done: (s: FaislaState) => s.memo !== null },
] as const;

type StepValue = (typeof STEPS)[number]["value"];

function isStep(v: string | undefined): v is StepValue {
  return STEPS.some((s) => s.value === v);
}

// Panels whose local state (draft form, inbox polling) must survive switching tabs.
const KEEP_MOUNTED: StepValue[] = ["quotation", "market", "offers"];

export default function DecisionWorkspace({ initialStep }: { initialStep?: string }) {
  const { state, status, saveStatus, reset } = useStore();
  const topRef = useRef<HTMLDivElement>(null);
  const done = STEPS.map((s) => s.done(state));
  const [step, setStep] = useState<StepValue>(() => {
    if (isStep(initialStep)) return initialStep;
    const firstOpen = done.findIndex((d) => !d);
    return STEPS[firstOpen === -1 ? STEPS.length - 1 : firstOpen].value;
  });

  function goTo(next: StepValue, scroll = false) {
    setStep(next);
    // Shallow URL update: Next keeps it in sync without re-rendering the server page.
    const params = new URLSearchParams(window.location.search);
    params.set("step", next);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
    if (scroll && topRef.current && topRef.current.getBoundingClientRect().top < 0) {
      topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const doneCount = done.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href="/decisions"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          All decisions
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <EditableTitle />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <DecisionStatusBadge status={status ?? "draft"} />
              <SaveIndicator saveStatus={saveStatus} />
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
              <RotateCcw data-icon="inline-start" />
              Start over
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start this decision over?</AlertDialogTitle>
                <AlertDialogDescription>
                  Clears the quotation, offers, supplier emails, comparison and memo. The title and your company profile stay.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    reset();
                    goTo("quotation");
                    toast.success("Decision cleared", { description: "Upload a quotation to begin again." });
                  }}
                >
                  Start over
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <CompanyLine company={state.company} />
      </header>

      <Tabs value={step} onValueChange={(v) => goTo(v as StepValue)} className="gap-5">
        <div ref={topRef} className="flex scroll-mt-20 flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              Step {STEPS.findIndex((s) => s.value === step) + 1} of {STEPS.length}
            </span>
            <span className="font-mono tabular-nums">
              {doneCount}/{STEPS.length} done
            </span>
          </div>
          {/* Scrolls sideways on small screens. */}
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
            <TabsList
              variant="line"
              className="w-max min-w-full justify-start gap-0 border-b p-0 group-data-horizontal/tabs:h-auto"
            >
              {STEPS.map((s, i) => (
                <TabsTrigger
                  key={s.value}
                  value={s.value}
                  className="h-auto flex-none gap-2 rounded-none px-3 py-2.5 after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]"
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full font-mono text-[11px] font-semibold tabular-nums transition-colors",
                      done[i]
                        ? "bg-success/15 text-success"
                        : "border border-border text-muted-foreground in-data-active:border-primary in-data-active:bg-primary in-data-active:text-primary-foreground",
                    )}
                  >
                    {done[i] ? <Check className="size-3" strokeWidth={3} aria-label="done" /> : i + 1}
                  </span>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        {STEPS.map((s, i) => (
          <TabsContent key={s.value} value={s.value} keepMounted={KEEP_MOUNTED.includes(s.value)} className="flex flex-col gap-5">
            <StepBody step={s.value} />
            <div className="flex items-center justify-between gap-3 border-t pt-4">
              {i > 0 ? (
                <Button variant="ghost" onClick={() => goTo(STEPS[i - 1].value, true)}>
                  <ArrowLeft data-icon="inline-start" />
                  <span className="hidden sm:inline">{STEPS[i - 1].label}</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              ) : (
                <span />
              )}
              {i < STEPS.length - 1 && (
                <Button variant={done[i] ? "default" : "outline"} onClick={() => goTo(STEPS[i + 1].value, true)}>
                  Next step
                  <span className="hidden sm:inline">: {STEPS[i + 1].label}</span>
                  <ArrowRight data-icon="inline-end" />
                </Button>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StepBody({ step }: { step: StepValue }) {
  switch (step) {
    case "quotation":
      return <QuotationStep />;
    case "market":
      return (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <MarketCard />
          <ReputationCard />
        </div>
      );
    case "offers":
      return <SupplierPanel />;
    case "compare":
      return <ComparisonTable />;
    case "decide":
      return <MemoPanel />;
  }
}

function EditableTitle() {
  const { state, update } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const clean = draft.trim();
    if (clean && clean !== state.title) update({ title: clean });
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        aria-label="Decision title"
        maxLength={120}
        value={draft}
        className="h-10 max-w-2xl font-heading text-xl font-semibold md:text-2xl"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      title="Rename"
      className="group/title -mx-1.5 flex max-w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      onClick={() => {
        setDraft(state.title);
        setEditing(true);
      }}
    >
      <h1 className="truncate font-heading text-xl font-semibold tracking-tight md:text-2xl">
        {state.title || "Untitled decision"}
      </h1>
      <Pencil className="size-4 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover/title:opacity-100" />
    </button>
  );
}

function SaveIndicator({ saveStatus }: { saveStatus: SaveStatus }) {
  const base = "inline-flex items-center gap-1.5 text-xs";
  if (saveStatus === "saving") {
    return (
      <span className={cn(base, "text-muted-foreground")} aria-live="polite">
        <Spinner className="size-3.5" />
        Saving…
      </span>
    );
  }
  if (saveStatus === "error") {
    return (
      <span className={cn(base, "text-destructive")} aria-live="polite">
        <CircleAlert className="size-3.5" />
        Couldn&apos;t save
      </span>
    );
  }
  return (
    <span className={cn(base, "text-muted-foreground")} aria-live="polite">
      <CloudCheck className="size-3.5" />
      {saveStatus === "saved" ? "Saved" : "Autosaves as you go"}
    </span>
  );
}

function CompanyLine({ company }: { company: FaislaState["company"] }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{company.name}</span>
      <span>
        Cash <span className="font-mono text-foreground tabular-nums">{formatPKR(company.cashBalance)}</span>
      </span>
      <span>
        Fixed costs <span className="font-mono text-foreground tabular-nums">{formatPKR(company.monthlyFixedCosts)}</span>/month
      </span>
      <span>{company.isExporter ? "Exporter · LTFF eligible" : "Not an exporter"}</span>
      <Link href="/settings" className="ml-auto text-primary underline-offset-4 hover:underline">
        Edit in Settings
      </Link>
    </p>
  );
}
