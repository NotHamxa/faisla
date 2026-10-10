"use client";
// "New decision" dialog: name the purchase, choose how to start (quotation or described need),
// create a draft, jump into its workspace.
// Works controlled (open/onOpenChange) or uncontrolled with an optional trigger element.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { DecisionOrigin, DecisionRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORIGINS: { value: DecisionOrigin; label: string; hint: string; icon: typeof FileText }[] = [
  { value: "quotation", label: "I have a supplier's quotation", hint: "Upload a photo or PDF", icon: FileText },
  { value: "need", label: "Describe what I need", hint: "Faisla finds options on the web", icon: MessageSquareText },
];

export default function NewDecisionDialog({
  open,
  onOpenChange,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [innerOpen, setInnerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [origin, setOrigin] = useState<DecisionOrigin>("quotation");
  const [creating, setCreating] = useState(false);
  const isOpen = open ?? innerOpen;

  function setOpen(next: boolean) {
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
    if (!next) {
      setTitle("");
      setOrigin("quotation");
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: clean, origin }),
      });
      const data = (await res.json().catch(() => null)) as { decision?: DecisionRecord; error?: string } | null;
      if (!res.ok || !data?.decision) throw new Error(data?.error ?? `Couldn't create the decision (${res.status})`);
      toast.success("Decision created", {
        description: origin === "need" ? "Start by describing what you need." : "Start by uploading the supplier's quotation.",
      });
      setOpen(false);
      router.push(`/decisions/${data.decision.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the decision");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(next) => setOpen(next)}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={create} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New purchase decision</DialogTitle>
            <DialogDescription>
              Name what you&apos;re buying and how you want to start. Faisla then compares every way to pay.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="new-decision-title">What are you buying?</FieldLabel>
            <Input
              id="new-decision-title"
              autoFocus
              maxLength={120}
              placeholder="e.g. 80 × Jack F5 lockstitch machines"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <FieldDescription>You can rename it any time.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel id="new-decision-origin">How do you want to start?</FieldLabel>
            <div role="radiogroup" aria-labelledby="new-decision-origin" className="grid gap-2 sm:grid-cols-2">
              {ORIGINS.map((o) => {
                const active = origin === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setOrigin(o.value)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active ? "border-primary border-l-[3px] bg-card" : "border-border hover:bg-muted/60",
                    )}
                  >
                    <o.icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{o.label}</span>
                      <span className="text-xs text-muted-foreground">{o.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!title.trim() || creating}>
              {creating && <Spinner />}
              {creating ? "Creating…" : "Create decision"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
