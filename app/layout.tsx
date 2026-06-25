import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import type { Metadata } from "next";

const SITE_URL = "https://kryptonai.tech";
const SITE_NAME = "Krypton AI";
const SITE_TITLE = "Krypton AI — Build Websites, Apps & Games with AI";
const SITE_DESC  = "Build professional websites, web apps, and browser games with AI in seconds. No coding needed. Powered by Krypton Intelligence Engine.";

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESC,
  keywords: [
    "AI website builder", "AI app generator", "AI game builder",
    "no code website", "Krypton AI", "AI web design", "generate website",
    "AI landing page", "build with AI", "website generator",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  metadataBase: new URL(SITE_URL),

  // ── Open Graph ──────────────────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESC,
    siteName: SITE_NAME,
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Krypton AI — Build Websites, Apps & Games with AI",
        type: "image/svg+xml",
      },
    ],
  },

  // ── Twitter / X ──────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    site: "@kryptonai",
    creator: "@kryptonai",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: ["/og-image.svg"],
  },

  // ── Favicon chain ────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: "/favicon.ico",        sizes: "any"     },
      { url: "/favicon-16x16.svg",  sizes: "16x16",  type: "image/svg+xml" },
      { url: "/favicon-32x32.svg",  sizes: "32x32",  type: "image/svg+xml" },
      { url: "/logo.svg",           sizes: "any",    type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },

  // ── Web app / PWA ─────────────────────────────────────────────────────
  manifest: "/manifest.json",
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },

  // ── SEO ──────────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

// ── Structured Data — Organization (Google / rich results) ────────────
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.svg`,
        width: 512,
        height: 512,
      },
      description: SITE_DESC,
      sameAs: [
        "https://twitter.com/kryptonai",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESC,
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/create?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESC,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />

        {/* Favicon fallbacks for older browsers */}
        <link rel="icon"             href="/favicon.ico"        sizes="any"/>
        <link rel="icon"             href="/logo.svg"           type="image/svg+xml"/>
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg"/>
        <link rel="manifest"         href="/manifest.json"/>

        {/* Theme */}
        <meta name="theme-color"                       content="#050816"/>
        <meta name="color-scheme"                      content="dark"/>
        <meta name="apple-mobile-web-app-capable"      content="yes"/>
        <meta name="apple-mobile-web-app-title"        content="Krypton AI"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <meta name="mobile-web-app-capable"            content="yes"/>
        <meta name="msapplication-TileColor"           content="#050816"/>
        <meta name="msapplication-TileImage"           content="/logo.svg"/>

        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body style={{ margin: 0 }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
