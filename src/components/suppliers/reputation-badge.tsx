// Reputation flag as a badge (code-scored in lib/reputation.ts; red flags never change the money figures).
import { cn } from "@/lib/utils";
import type { ReputationFlag } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const FLAGS: Record<ReputationFlag, { text: string; tone: string }> = {
  good: { text: "Good", tone: "bg-success/10 text-success" },
  mixed: { text: "Mixed", tone: "bg-warning/10 text-warning" },
  red: { text: "Red flags", tone: "bg-destructive/10 text-destructive" },
  not_enough: { text: "Not enough reviews", tone: "bg-secondary text-muted-foreground" },
};

export function ReputationBadge({ flag, className }: { flag: ReputationFlag; className?: string }) {
  const f = FLAGS[flag];
  return <Badge className={cn(f.tone, className)}>{f.text}</Badge>;
}

export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-dashed font-normal text-muted-foreground", className)}>
      simulated
    </Badge>
  );
}
