"use server";

import { AuthError } from "next-auth";

import { isRedirectError } from "@/lib/next";
import { signIn, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { loginSchema, signupSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const callbackUrl = formValue(formData, "callbackUrl") || "/dashboard";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl.startsWith("/") ? callbackUrl : "/dashboard",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
  return {};
}

export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error: "An account with that email already exists.",
      fieldErrors: { email: "Already registered — try logging in." },
    };
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });

  await recordAudit({
    action: "auth.register",
    actorId: user.id,
    targetType: "User",
    targetId: user.id,
    metadata: { email },
  });

  const next = formValue(formData, "next");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: next.startsWith("/") ? next : "/onboarding",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      // Account was created; ask them to log in manually.
      return { error: "Account created. Please log in." };
    }
    throw error;
  }
  return {};
}
