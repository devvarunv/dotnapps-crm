import { Construction } from "lucide-react";
import { PageHeader } from "./page-header";

const PHASE_LABEL: Record<number, string> = {
  2: "Phase 2 — CRM Core",
  3: "Phase 3 — Sales Pipeline",
  4: "Phase 4 — Dotnapps Invoice Revenue Integration",
  6: "Phase 6 — Reports & Analytics",
};

export function ModulePlaceholder({
  title,
  description,
  phase,
  bullets,
}: {
  title: string;
  description: string;
  phase: number;
  bullets: string[];
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
          <Construction className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium">
          This module ships in {PHASE_LABEL[phase] ?? `phase ${phase}`}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          The navigation, permissions, and tenant scoping are already in place.
          The screens and data for this area are built next.
        </p>
        <ul className="mx-auto mt-5 grid max-w-md gap-1.5 text-left text-sm text-muted-foreground">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="text-muted-foreground/60">•</span>
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
