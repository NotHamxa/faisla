"use client";
import { useStore } from "@/lib/store";

export default function AppHeader() {
  const { reset } = useStore();
  return (
    <header className="border-b border-line bg-white/80 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold tracking-tight text-brand">Faisla</span>
          <span className="text-lg text-muted" lang="ur">فیصلہ</span>
          <span className="hidden text-sm text-muted sm:inline">CFO-in-a-box for SMEs</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-warn">Demo data</span>
          <button
            className="btn-ghost text-xs"
            onClick={() => {
              if (confirm("Start over? This clears the quotation, offers and decision.")) reset();
            }}
          >
            Start over
          </button>
        </div>
      </div>
    </header>
  );
}
