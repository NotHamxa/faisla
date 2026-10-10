// Reputation flag as a badge (code-scored in lib/reputation.ts; red flags never change the money figures).
import { cn } from "@/lib/utils";
import type { ReputationFlag } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const FLAGS: Record<ReputationFlag, { text: string; variant: "success" | "warning" | "destructive" | "muted" }> = {
  good: { text: "Good", variant: "success" },
  mixed: { text: "Mixed", variant: "warning" },
  red: { text: "Red flags", variant: "destructive" },
  not_enough: { text: "Not enough reviews", variant: "muted" },
};

export function ReputationBadge({ flag, className }: { flag: ReputationFlag; className?: string }) {
  const f = FLAGS[flag];
  return <Badge variant={f.variant} className={className}>{f.text}</Badge>;
}

export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-dashed font-normal text-muted-foreground", className)}>
      simulated
    </Badge>
  );
}
