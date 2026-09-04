import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dotnapps CRM",
    template: "%s · Dotnapps CRM",
  },
  description:
    "Turn leads into customers. Customers into revenue. A modern, multi-tenant CRM for leads, contacts, companies, deals, and revenue.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
