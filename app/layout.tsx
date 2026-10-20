import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pricewise — Price Tracker",
  description: "Track product prices and catch the right time to buy.",
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
