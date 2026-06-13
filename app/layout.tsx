import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Krypton AI — Build Websites, Apps & Games with AI",
    template: "%s | Krypton AI",
  },
  description: "Build professional websites, web apps, and browser games with AI in seconds. No coding needed. Powered by Krypton Intelligence Engine.",
  keywords: ["AI website builder", "AI app generator", "AI game builder", "no code", "Krypton AI", "Krypton AI"],
  authors: [{ name: "Krypton AI" }],
  creator: "Krypton AI",
  metadataBase: new URL("https://magic-krypton-ai.vercel.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://magic-krypton-ai.vercel.app",
    title: "Krypton AI — Build with AI",
    description: "Build professional websites, apps & games with AI in seconds.",
    siteName: "Krypton AI",
    images: [{ url: "/logo.svg", width: 512, height: 512, alt: "Krypton AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Krypton AI — Build with AI",
    description: "Build websites, apps & games with AI in seconds.",
    images: ["/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#07091A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Krypton AI" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/logo.svg" />
      </head>
      <body style={{ margin: 0 }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
