import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PricePulse Bangladesh — Price Tracker",
  description: "Compare product prices and catch the right time to buy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
