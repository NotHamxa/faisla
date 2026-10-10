"use client";
// Light / dark / system appearance picker (next-themes).
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS: { value: "light" | "dark" | "system"; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

const noopSubscribe = () => () => {};

export function ThemeSelector() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  // The stored theme is only known in the browser; render neutral on the server to avoid a mismatch.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const current = mounted ? (theme ?? "system") : null;

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(value)}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
                active && "border-foreground border-b-[3px] bg-card text-foreground hover:bg-card",
              )}
            >
              {active && <CheckIcon className="absolute top-2 right-2 size-3.5" />}
              <Icon className="size-5" />
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {mounted && theme === "system" && resolvedTheme
          ? `Following your device: currently ${resolvedTheme}.`
          : "Saved in this browser."}
      </p>
    </div>
  );
}
