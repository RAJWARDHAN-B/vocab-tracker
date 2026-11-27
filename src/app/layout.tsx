import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fern",
  description: "A private vocabulary garden for daily practice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
