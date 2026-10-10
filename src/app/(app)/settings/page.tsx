// Settings: company profile, account, appearance, and what data is real vs simulated.
import type { Metadata } from "next";
import { Building2Icon, CalculatorIcon, FlaskConicalIcon, PaletteIcon, SparklesIcon, UserIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/server/repo";
import { StoreProvider } from "@/lib/store";
import ProfileForm from "@/components/ProfileForm";
import { ThemeSelector } from "@/components/settings/theme-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Details } from "@/components/simple";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Settings · Faisla" };

const SIMULATED = [
  {
    what: "Company profile and demo decisions",
    detail: "Fictional business (Hamza Garments), labelled “Demo data”.",
  },
  {
    what: "Supplier quotations and suppliers",
    detail: "Fictional suppliers; RFQ emails only go to team test inboxes.",
  },
  {
    what: "Market benchmark table",
    detail: "Simulated 60-row price table. The Jack F5 web prices beside it are real listings (3 new units, with links).",
  },
  {
    what: "Supplier reviews",
    detail: "Reviews of the fictional suppliers are simulated and tagged “simulated”. Jack F5 product reviews are real, with links.",
  },
  {
    what: "Emails without mail keys",
    detail: "Saved but not sent, tagged “simulated”.",
  },
];

export default async function SettingsPage() {
  const user = await requireUser();
  const company = await getCompany(user.companyId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1 border-b border-foreground/80 pb-4">
        <h1 className="text-[1.75rem] leading-tight font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your company, account and theme.</p>
      </div>

      <section id="company" className="scroll-mt-20">
        {company ? (
          <StoreProvider company={company}>
            <ProfileForm />
          </StoreProvider>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2Icon className="size-4 text-muted-foreground" />
                Company profile
              </CardTitle>
              <CardDescription>Company profile not found. Sign out and sign in again.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card id="account" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="size-4 text-muted-foreground" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field>
              <FieldLabel htmlFor="account-name">Name</FieldLabel>
              <Input id="account-name" value={user.name} readOnly disabled />
            </Field>
            <Field>
              <FieldLabel htmlFor="account-email">Email</FieldLabel>
              <Input id="account-email" type="email" value={user.email} readOnly disabled />
            </Field>
          </CardContent>
        </Card>

        <Card id="appearance" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PaletteIcon className="size-4 text-muted-foreground" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeSelector />
          </CardContent>
        </Card>
      </div>

      <Card id="about" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConicalIcon className="size-4 text-muted-foreground" />
            About &amp; data disclosure
          </CardTitle>
          <CardDescription>What is real and what is simulated.</CardDescription>
        </CardHeader>
        <CardContent className="-mb-2">
          <Details title="Show details">
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[2px] border border-t-[3px] border-t-primary p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <SparklesIcon className="size-4 text-primary" />
                    AI reads
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Quotation photos, search results, reviews and supplier emails (including Roman Urdu) are read by AI
                    into structured fields you can check. AI also writes the memo&apos;s words.
                  </p>
                </div>
                <div className="rounded-[2px] border border-t-[3px] border-t-primary p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalculatorIcon className="size-4 text-primary" />
                    Code calculates
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every rupee: the cost of paying later, monthly installments and rentals, present value, after-tax
                    cost, runway and the stress test. Each memo number is checked against the calculation. The owner
                    confirms.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Simulated data</h3>
                <ul className="divide-y rounded-lg border text-sm">
                  {SIMULATED.map((s) => (
                    <li
                      key={s.what}
                      className="flex flex-col gap-0.5 p-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                    >
                      <span className="font-medium">{s.what}</span>
                      <span className="text-muted-foreground sm:text-right">{s.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                KIBOR and the SBP policy rate are reference values to verify before use; tax rate, depreciation and
                Islamic LTFF eligibility are assumptions listed on every comparison. Shariah compliance of a product is
                confirmed by the bank&apos;s Shariah board, not by Faisla. Not financial or religious advice.
              </p>
            </div>
          </Details>
        </CardContent>
      </Card>
    </div>
  );
}
