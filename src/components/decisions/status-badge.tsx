// One look for a decision's status everywhere (list, workspace header, dashboard).
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DecisionStatus } from "@/lib/types";

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  draft: "Draft",
  collecting: "Collecting offers",
  comparing: "Comparing",
  decided: "Decided",
};

const STATUS_CLASS: Record<DecisionStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  collecting: "bg-accent text-accent-foreground",
  comparing: "bg-warning/10 text-warning",
  decided: "bg-success/10 text-success",
};

export function DecisionStatusBadge({ status, className }: { status: DecisionStatus; className?: string }) {
  return <Badge className={cn(STATUS_CLASS[status], className)}>{STATUS_LABEL[status]}</Badge>;
}
