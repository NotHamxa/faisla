// Decision status as a coloured badge (label + colour, never colour alone).
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DecisionStatus } from "@/lib/types";

const STATUS: Record<DecisionStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "" },
  collecting: { label: "Collecting quotes", className: "border-primary/40 text-primary" },
  comparing: { label: "Comparing", className: "border-warning/50 text-warning" },
  decided: { label: "Decided", className: "border-success/40 text-success" },
};

export function StatusBadge({ status, className }: { status: DecisionStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <Badge variant="muted" className={cn(s.className, className)}>
      {s.label}
    </Badge>
  );
}
