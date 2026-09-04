import Link from "next/link";
import { Plug } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";

export function IntegrationSetupNotice() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
        <Plug className="size-5 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">Dotnapps Invoice isn&apos;t connected</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Connect Dotnapps Invoice to see quotations, invoices and payments here.
        The CRM never creates or calculates these itself.
      </p>
      <Link
        href="/settings/integrations"
        className={buttonClassName({ variant: "outline", size: "sm", className: "mt-4" })}
      >
        Go to integration settings
      </Link>
    </div>
  );
}
