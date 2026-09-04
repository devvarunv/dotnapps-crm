import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/context";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.membership ? "/dashboard" : "/onboarding");

  const { callbackUrl } = await searchParams;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Log in to your Dotnapps CRM workspace.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <LoginForm callbackUrl={callbackUrl} />
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        New to Dotnapps CRM?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
