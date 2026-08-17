import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Best Picks",
  description: "AI-generated daily sports betting picks, for informational use only.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
