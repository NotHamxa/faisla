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
      <aside className="relative hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col xl:p-14">
        <div className="flex items-center gap-3 border-b border-current/25 pb-5">
          <BrandMark className="bg-primary-foreground text-primary" />
          <div className="leading-tight">
            <div className="font-heading text-lg font-bold">
              Faisla <span className="font-normal opacity-80">— فیصلہ</span>
            </div>
            <div className="text-sm opacity-75">CFO-in-a-box for SMEs</div>
          </div>
        </div>

        <div className="my-auto max-w-lg space-y-10 py-12">
          <div className="space-y-4">
            <p className="text-sm font-medium opacity-75">AI reads · code calculates · you confirm</p>
            <h1 className="text-4xl leading-[1.05] font-bold text-balance xl:text-5xl">
              Every big purchase, decided like a CFO would.
            </h1>
          </div>
          <ul className="border-t border-current/25">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="grid grid-cols-[1.25rem_1fr] gap-x-4 border-b border-current/25 py-4">
                <Icon className="mt-0.5 size-4 opacity-80" />
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm opacity-75">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-start gap-3 border-t-[3px] border-double border-current/50 pt-4 text-sm">
          <BadgeCheck className="mt-0.5 size-4 shrink-0" />
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
              <div className="font-heading font-bold">Faisla</div>
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
