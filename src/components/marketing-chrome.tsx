import Link from "next/link";
import { Logo } from "@/components/brand";
import { buttonClassName } from "@/components/ui/button";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/pricing"
            className="hidden px-3 py-2 text-muted-foreground hover:text-foreground sm:inline-block"
          >
            Pricing
          </Link>
          <Link href="/login" className={buttonClassName({ variant: "ghost", size: "sm" })}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClassName({ size: "sm" })}>
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Logo href="/" className="text-sm" />
        <p>
          Part of the Dotnapps Business Suite. Dotnapps Invoice is the financial
          source of truth.
        </p>
        <p>© {new Date().getFullYear()} Dotnapps</p>
      </div>
    </footer>
  );
}
