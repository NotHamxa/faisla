"use client";
// Small building blocks for a quiet, plain-language UI: a "?" help tip, a collapsed "Details" disclosure,
// the one-per-step "Demo" menu, and one-line tooltips for Islamic finance terms.
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { ChevronDown, CircleHelp, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// "?" next to a word: opens on hover (desktop) or tap (mobile) with one or two plain sentences.
export function HelpTip({
  children,
  label = "What does this mean?",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        openOnHover
        delay={150}
        aria-label={label}
        className={cn(
          "inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <CircleHelp className="size-3.5" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={6} className="isolate z-50">
          <PopoverPrimitive.Popup className="z-50 max-w-72 rounded-[2px] border bg-popover px-3 py-2 text-left text-xs leading-relaxed font-normal tracking-normal text-popover-foreground normal-case shadow-md outline-none">
            {children}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// A collapsed section for everything advanced. Closed by default.
export function Details({
  title,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
  testId,
  hint,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  testId?: string;
  hint?: ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      className={cn("border-t", className)}
      data-testid={testId}
    >
      <CollapsibleTrigger className="group/details flex w-full items-center gap-2 py-3 text-left text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown className="size-4 shrink-0 -rotate-90 transition-transform group-data-panel-open/details:rotate-0" />
        <span>{title}</span>
        {hint && <span className="ml-auto text-xs font-normal">{hint}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export type DemoAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: ReactNode;
};

// One quiet "Demo" button per step; the pitch helpers live inside it with their exact labels.
export function DemoMenu({ actions, className }: { actions: DemoAction[]; className?: string }) {
  const shown = actions.filter(Boolean);
  if (!shown.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className={cn("text-muted-foreground", className)} />}
      >
        <FlaskConical data-icon="inline-start" />
        Demo
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-48">
        {shown.map((a) => (
          <DropdownMenuItem
            key={a.label}
            disabled={a.disabled}
            variant={a.danger ? "destructive" : "default"}
            onClick={a.onClick}
          >
            {a.icon}
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// One line under a step's title: what to do here.
export function StepHint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}

// One-line meanings for the Islamic finance names (they keep their names everywhere).
export const TERM_HELP: Record<string, string> = {
  "Diminishing Musharakah": "You and the bank co-own the machines; you buy the bank's share monthly.",
  Ijarah: "The bank leases the machines to you for a monthly rent.",
  "Islamic LTFF": "SBP's cheap Shariah-compliant financing for exporters.",
  Murabaha: "The bank buys the machines and sells them to you at a fixed higher price, paid monthly.",
  "deferred-price plan": "The supplier's own pay-later plan. Its price is fixed upfront.",
};

// Adds a "?" after an option label when it names an Islamic finance term.
export function TermTip({ label }: { label: string }) {
  const key = Object.keys(TERM_HELP).find((k) => label.includes(k));
  if (!key) return null;
  return <HelpTip label={`What is ${key}?`}>{TERM_HELP[key]}</HelpTip>;
}
