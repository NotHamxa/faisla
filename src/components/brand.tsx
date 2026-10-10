// Faisla wordmark: the green tile with فیصلہ's first letter, shared by the auth screens and the sidebar.
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[2px] bg-primary pb-0.5 text-lg leading-none font-semibold text-primary-foreground",
        className,
      )}
    >
      ف
    </div>
  );
}
