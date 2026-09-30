import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FundTec",
  description: "Fund management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
