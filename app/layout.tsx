import type { Metadata, Viewport } from "next";
import { Playfair_Display } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { FloatingContacts } from "@/components/FloatingContacts";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getLocaleFromPathname } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";
import "./globals.css";

const bodyFont = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap"
});

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSiteContent();

  return {
    metadataBase: new URL(site.canonicalUrl),
    applicationName: site.name,
    title: {
      default: "Ordu Merkezde Tarihi Otel",
      template: `%s | ${site.name}`
    },
    description: site.description,
    keywords: [
      site.name,
      "Ordu otel",
      "Altınordu otel",
      "Ordu merkez otel",
      "tarihi otel Ordu",
      "butik otel Ordu"
    ],
    authors: [{ name: site.name }],
    creator: site.name,
    publisher: site.name,
    alternates: {
      canonical: site.canonicalUrl
    },
    openGraph: {
      type: "website",
      locale: "tr_TR",
      url: site.canonicalUrl,
      title: `${site.name} | Ordu Merkezde Tarihi Otel`,
      description: site.description,
      images: ["/og.webp"]
    },
    twitter: {
      card: "summary_large_image",
      title: `${site.name} | Ordu Merkez`,
      description: site.description,
      images: ["/og.webp"]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    },
    category: "hotel",
    icons: {
      icon: [
        { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }
      ],
      shortcut: "/favicon.png",
      apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    },
    manifest: "/manifest.webmanifest"
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0f3a52" }
  ]
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "";
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/dashboard");
  const locale = getLocaleFromPathname(pathname);
  const content = isAdminRoute ? null : await getSiteContent();

  return (
    <html lang={locale} className={bodyFont.variable}>
      <body>
        {isAdminRoute ? null : <Header locale={locale} />}
        <main>{children}</main>
        {content ? <Footer content={content} locale={locale} /> : null}
        {content ? <FloatingContacts content={content} locale={locale} /> : null}
      </body>
    </html>
  );
}
