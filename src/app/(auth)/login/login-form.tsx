"use client";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import { login } from "@/lib/auth/actions";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/constants";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function LoginForm({ next }: { next: string | null }) {
  const [state, formAction, pending] = useActionState(login, undefined);
  const errors = state?.fieldErrors;

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your company&apos;s decisions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} noValidate>
            {next && <input type="hidden" name="next" value={next} />}
            <FieldGroup className="gap-4">
              {state?.error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>{state.error}</AlertTitle>
                </Alert>
              )}
              <Field data-invalid={!!errors?.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.pk"
                  defaultValue={state?.values?.email}
                  aria-invalid={!!errors?.email}
                  required
                />
                <FieldError>{errors?.email}</FieldError>
              </Field>
              <Field data-invalid={!!errors?.password}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors?.password}
                  required
                />
                <FieldError>{errors?.password}</FieldError>
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Spinner /> : null}
                Sign in
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {/* Demo box: judges sign in with one click. */}
      <form action={formAction} className="rounded-xl border border-primary/30 bg-accent p-4 text-accent-foreground">
        <input type="hidden" name="email" value={DEMO_EMAIL} />
        <input type="hidden" name="password" value={DEMO_PASSWORD} />
        {next && <input type="hidden" name="next" value={next} />}
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="text-sm font-medium">Demo account</div>
              <div className="font-mono text-sm break-all">
                {DEMO_EMAIL} / {DEMO_PASSWORD}
              </div>
            </div>
            <Button type="submit" variant="default" className="w-full" disabled={pending}>
              {pending ? <Spinner /> : null}
              Sign in as demo
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to Faisla?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
