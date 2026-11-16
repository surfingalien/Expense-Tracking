import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "./providers";
import { devBypassUserId } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Tracker — AI Receipt Scanning & Analytics",
  description:
    "Track daily, weekly and monthly expenses. Scan receipts with AI, auto-categorize spending, set budgets and generate PDF/CSV reports.",
  keywords: ["expense tracker", "receipt scanner", "budget", "personal finance", "analytics"],
  applicationName: "Expense Tracker",
  icons: {
    icon: "/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Expenses",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authEnabled = !devBypassUserId;
  const app = (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers authEnabled={authEnabled}>{children}</Providers>
      </body>
    </html>
  );
  return authEnabled ? <ClerkProvider>{app}</ClerkProvider> : app;
}
