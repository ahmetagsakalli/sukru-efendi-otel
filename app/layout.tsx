import type { Metadata, Viewport } from "next";
import { Montserrat, Playfair_Display, Roboto } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { FloatingContacts } from "@/components/FloatingContacts";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getSiteContent } from "@/lib/site-content";
import "./globals.css";

const bodyFont = Roboto({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-body",
  display: "swap"
});

const headingFont = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-heading",
  display: "swap"
});

const accentFont = Montserrat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-accent",
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
      icon: "/favicon.svg",
      shortcut: "/favicon.svg"
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

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "";
  const isAdminRoute = pathname.startsWith("/admin");

  return (
    <html lang="tr">
      <body className={`${bodyFont.variable} ${headingFont.variable} ${accentFont.variable}`}>
        {isAdminRoute ? null : <Header />}
        <main>{children}</main>
        {isAdminRoute ? null : <Footer />}
        {isAdminRoute ? null : <FloatingContacts />}
      </body>
    </html>
  );
}
