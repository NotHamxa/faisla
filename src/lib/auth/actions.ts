"use server";
// Server actions for the auth screens and the dashboard's "Load sample data" button.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_EMAIL } from "@/lib/auth/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import { createUserWithCompany, findUserByEmail } from "@/lib/server/repo";
import { ensureDemoAccount, seedSampleDecisions } from "@/lib/server/seed";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "companyName" | "email" | "password", string>>;
  values?: { name?: string; companyName?: string; email?: string };
} | undefined;

const email = z.string().trim().toLowerCase().email("Enter a valid email address");

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  companyName: z.string().trim().min(2, "Enter your company name"),
  email,
  password: z.string().min(8, "Use at least 8 characters"),
});

function firstErrors(error: z.ZodError): NonNullable<AuthFormState>["fieldErrors"] {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    out[key] ??= issue.message;
  }
  return out;
}

const DB_DOWN = "Can't reach the database right now. Please try again in a moment.";

// Only same-site paths, so `next` can't bounce the user to another domain.
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") && !next.startsWith("/signup")
    ? next
    : "/dashboard";
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };

  // redirect() throws, so it stays outside the try that turns database failures into a form error.
  try {
    // First demo sign-in creates the account and its sample decisions.
    if (parsed.data.email === DEMO_EMAIL) await ensureDemoAccount();

    const user = await findUserByEmail(parsed.data.email);
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return { error: "Wrong email or password", values };
    }
    await createSession(user._id);
  } catch (err) {
    console.error("[auth] login failed", err);
    return { error: DB_DOWN, values };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    name: formData.get("name"),
    companyName: formData.get("companyName"),
    email: formData.get("email"),
    password: formData.get("password"),
  };
  const values = { name: String(raw.name ?? ""), companyName: String(raw.companyName ?? ""), email: String(raw.email ?? "") };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };

  const taken = { fieldErrors: { email: "An account with this email already exists. Sign in instead." }, values };
  let userId;
  try {
    if (await findUserByEmail(parsed.data.email)) return taken;
    const user = await createUserWithCompany({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      // Not the demo profile: no exporter/LTFF assumption; the owner sets cash and costs in Settings.
      company: { name: parsed.data.companyName, city: "", isExporter: false },
    });
    userId = user._id;
  } catch (err) {
    // Unique index on email: a parallel signup won the race.
    if ((err as { code?: number }).code === 11000) return taken;
    console.error("[auth] signup failed", err);
    return { error: DB_DOWN, values };
  }
  try {
    await createSession(userId);
  } catch (err) {
    console.error("[auth] session failed", err);
    return { error: DB_DOWN, values };
  }
  redirect("/settings?welcome=1#company");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function loadSampleData(): Promise<void> {
  const user = await requireUser();
  await seedSampleDecisions(user.companyId);
  revalidatePath("/dashboard");
}
