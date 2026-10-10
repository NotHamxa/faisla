// Two-column shell for /login and /signup: brand story on the left, the form on the right.
import { BadgeCheck, Calculator, Landmark, ScanText } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const VALUES = [
  { icon: ScanText, title: "Reads the quotation", text: "Photo in, every line item out. You confirm each field." },
  { icon: Calculator, title: "Finds the hidden cost", text: "“0% markup” plans, bank loans and SBP LTFF, compared after tax." },
  { icon: Landmark, title: "Protects your cash", text: "Shows how many months of salaries each option leaves in the bank." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col">
        {/* Soft rings for depth; currentColor keeps them on-theme in light and dark. */}
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full border-[48px] border-current opacity-[0.06]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full border-[64px] border-current opacity-[0.05]" />

        <div className="relative flex items-center gap-3">
          <BrandMark className="bg-primary-foreground text-primary" />
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-tight">
              Faisla <span className="font-normal opacity-80">— فیصلہ</span>
            </div>
            <div className="text-sm opacity-75">CFO-in-a-box for SMEs</div>
          </div>
        </div>

        <div className="relative my-auto max-w-md space-y-8 py-12">
          <div className="space-y-3">
            <p className="text-sm font-medium tracking-wide uppercase opacity-70">AI reads · code calculates · you confirm</p>
            <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance xl:text-4xl">
              Every big purchase, decided like a CFO would.
            </h1>
          </div>
          <ul className="space-y-5">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                  <Icon className="size-4.5" />
                </div>
                <div>
                  <div className="font-medium">{title}</div>
                  <div className="text-sm opacity-75">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 rounded-xl bg-primary-foreground/10 p-4 text-sm">
          <BadgeCheck className="size-5 shrink-0" />
          <span>
            In the demo, one sewing-machine purchase saves <span className="font-mono font-semibold tabular-nums">Rs 5.8 lakh</span> and
            keeps 2.5 months of costs in the bank.
          </span>
        </div>
      </aside>

      <main className="relative flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:invisible">
            <BrandMark />
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Faisla</div>
              <div className="text-xs text-muted-foreground">AI reads · code calculates · you confirm</div>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">Demo data is fictional and labelled. Numbers are calculated in code, never by AI.</p>
      </main>
    </div>
  );
}
