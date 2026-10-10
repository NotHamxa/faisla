"use client";
// "New decision" dialog: name the purchase, create a draft, jump into its workspace.
// Works controlled (open/onOpenChange) or uncontrolled with an optional trigger element.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import type { DecisionRecord } from "@/lib/types";

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
  const [creating, setCreating] = useState(false);
  const isOpen = open ?? innerOpen;

  function setOpen(next: boolean) {
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
    if (!next) setTitle("");
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
        body: JSON.stringify({ title: clean }),
      });
      const data = (await res.json().catch(() => null)) as { decision?: DecisionRecord; error?: string } | null;
      if (!res.ok || !data?.decision) throw new Error(data?.error ?? `Couldn't create the decision (${res.status})`);
      toast.success("Decision created", { description: "Start by uploading the supplier's quotation." });
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
              Name what you&apos;re buying. You&apos;ll upload the quotation and compare every way to pay next.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="new-decision-title">What are you buying?</FieldLabel>
            <Input
              id="new-decision-title"
              autoFocus
              maxLength={120}
              placeholder="e.g. 4 × JUKI AMS-221F pattern sewers"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <FieldDescription>You can rename it any time.</FieldDescription>
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
