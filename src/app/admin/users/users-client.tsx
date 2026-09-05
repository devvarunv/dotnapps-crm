"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { toggleSuperAdminAction } from "../actions";

export function ToggleSuperAdminButton({
  userId,
  name,
  isSuperAdmin,
}: {
  userId: string;
  name: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={isSuperAdmin ? "outline" : "subtle"}
        disabled={pending}
        onClick={() => {
          const verb = isSuperAdmin ? "Revoke" : "Grant";
          if (!confirm(`${verb} Super Admin access for ${name}?`)) return;
          const fd = new FormData();
          fd.set("userId", userId);
          fd.set("makeAdmin", isSuperAdmin ? "false" : "true");
          start(async () => {
            const r = await toggleSuperAdminAction(fd);
            setError(r.error ?? null);
            router.refresh();
          });
        }}
      >
        {isSuperAdmin ? "Revoke Super Admin" : "Make Super Admin"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
