"use client";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { signup } from "@/lib/auth/actions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const errors = state?.fieldErrors;
  const values = state?.values;

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Set up your company in under a minute. You can edit cash and costs later.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} noValidate>
            <FieldGroup className="gap-4">
              {state?.error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>{state.error}</AlertTitle>
                </Alert>
              )}
              <Field data-invalid={!!errors?.name}>
                <FieldLabel htmlFor="name">Your name</FieldLabel>
                <Input id="name" name="name" autoComplete="name" placeholder="Hamza Ahmed" defaultValue={values?.name} aria-invalid={!!errors?.name} required />
                <FieldError>{errors?.name}</FieldError>
              </Field>
              <Field data-invalid={!!errors?.companyName}>
                <FieldLabel htmlFor="companyName">Company name</FieldLabel>
                <Input
                  id="companyName"
                  name="companyName"
                  autoComplete="organization"
                  placeholder="Hamza Garments"
                  defaultValue={values?.companyName}
                  aria-invalid={!!errors?.companyName}
                  required
                />
                <FieldError>{errors?.companyName}</FieldError>
              </Field>
              <Field data-invalid={!!errors?.email}>
                <FieldLabel htmlFor="email">Work email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.pk"
                  defaultValue={values?.email}
                  aria-invalid={!!errors?.email}
                  required
                />
                <FieldError>{errors?.email}</FieldError>
              </Field>
              <Field data-invalid={!!errors?.password}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} aria-invalid={!!errors?.password} required />
                {errors?.password ? <FieldError>{errors.password}</FieldError> : <FieldDescription>At least 8 characters.</FieldDescription>}
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Spinner /> : null}
                Create account
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
