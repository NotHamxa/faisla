// Decision status as a coloured badge (label + colour, never colour alone).
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DecisionStatus } from "@/lib/types";

const STATUS: Record<DecisionStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-border text-muted-foreground" },
  collecting: { label: "Collecting quotes", className: "border-transparent bg-accent text-accent-foreground" },
  comparing: { label: "Comparing", className: "border-transparent bg-warning/10 text-warning" },
  decided: { label: "Decided", className: "border-transparent bg-success/10 text-success" },
};

export function StatusBadge({ status, className }: { status: DecisionStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <Badge variant="outline" className={cn(s.className, className)}>
      {s.label}
    </Badge>
  );
}
