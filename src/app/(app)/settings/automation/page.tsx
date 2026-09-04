import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireOrgContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import {
  CreateRule,
  RuleList,
  RunNowButton,
  RetryButton,
} from "./automation-client";

export const metadata: Metadata = { title: "Automation" };

export default async function AutomationSettingsPage() {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "org:manage")) {
    return <DeniedState message="Only owners and admins manage automation." />;
  }

  const [rules, executions] = await Promise.all([
    prisma.reminderRule.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { executions: true } } },
    }),
    prisma.reminderExecution.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { rule: { select: { name: true } } },
    }),
  ]);

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader
        title="Follow-up automation"
        description="Explicit condition → action rules. No AI. Every run is logged and idempotent."
        actions={<RunNowButton />}
      />

      <Card className="mb-6">
        <CardHeader><CardTitle>New rule</CardTitle></CardHeader>
        <CardContent><CreateRule /></CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Rules ({rules.length})</CardTitle></CardHeader>
        <CardContent>
          <RuleList
            rules={rules.map((r) => ({
              id: r.id,
              name: r.name,
              trigger: r.trigger,
              action: r.action,
              enabled: r.enabled,
              config: (r.config ?? {}) as Record<string, never>,
              fires: r._count.executions,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent executions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {executions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Nothing has run yet. Use “Run automation now” or wait for the
              scheduler.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {executions.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                  <span className="font-medium">{e.rule.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.targetType} {e.targetId?.slice(0, 8)}
                  </span>
                  <Badge
                    tone={
                      e.status === "DONE"
                        ? "success"
                        : e.status === "FAILED"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {e.status.toLowerCase()}
                  </Badge>
                  {e.error && <span className="text-xs text-destructive">{e.error}</span>}
                  {e.status === "FAILED" && <RetryButton id={e.id} />}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {e.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
