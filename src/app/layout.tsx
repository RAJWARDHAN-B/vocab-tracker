import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vocab Garden",
  description: "A private vocabulary tracker for daily practice.",
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
