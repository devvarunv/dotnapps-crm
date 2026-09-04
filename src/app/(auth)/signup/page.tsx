import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/context";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.membership ? "/dashboard" : "/onboarding");

  const { next } = await searchParams;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;ll set up your business in the next step.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <SignupForm next={next} />
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
