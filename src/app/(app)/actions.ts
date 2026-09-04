"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ACTIVE_ORG_COOKIE, getAuthContext } from "@/lib/context";

/** Set the active-organization cookie (server-action / route-handler only). */
export async function setActiveOrg(orgId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function switchOrgAction(formData: FormData): Promise<void> {
  const orgId = String(formData.get("orgId") ?? "");
  const session = await auth();
  if (!session?.user?.id || !orgId) return;

  // Only switch to an org the user is actually an active member of.
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, orgId, status: "ACTIVE" },
  });
  if (!membership) return;

  await setActiveOrg(orgId);
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE);
  await signOut({ redirectTo: "/login" });
}

/** Used by settings pages to re-check the caller still belongs to the org. */
export async function assertStillMember(): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx?.membership) redirect("/onboarding");
}
