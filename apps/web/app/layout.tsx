import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VECTORSHIFT · Geospatial routing instrument",
  description: "Worldwide map exploration with explicitly qualified local VECTORSHIFT graph coverage.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
