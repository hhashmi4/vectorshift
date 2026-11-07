import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VECTORSHIFT · Routing instrument",
  description: "Inspectable deterministic routing over the bounded Toronto reference graph.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
