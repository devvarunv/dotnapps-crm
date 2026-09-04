"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchBox({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => {
          router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
        });
      }}
      className="relative max-w-lg"
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search leads, contacts, companies…"
        className="pl-8"
      />
      {pending && (
        <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </form>
  );
}
