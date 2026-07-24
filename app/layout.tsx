import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { FloatingContacts } from "@/components/FloatingContacts";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { site } from "@/data/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.canonicalUrl),
  applicationName: site.name,
  title: {
    default: "Ordu Merkezde Tarihi Otel",
    template: "%s | Şükrü Efendi Ottoman Hotel"
  },
  description:
    "Şükrü Efendi Ottoman Hotel, Ordu şehir merkezinde 400 yıllık tarihi bir yapıda konaklama sunar.",
  keywords: [
    "Şükrü Efendi Ottoman Hotel",
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
    title: "Şükrü Efendi Ottoman Hotel | Ordu Merkezde Tarihi Otel",
    description: "Ordu şehir merkezinde 400 yıllık tarihi bir yapıda sakin ve özenli konaklama.",
    images: ["/og.png"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Şükrü Efendi Ottoman Hotel | Ordu Merkez",
    description:
      "Ordu'nun merkezinde, tarihi bir yapının sakinliğini şehir hayatına yakın bir konaklama deneyimiyle buluşturan butik otel.",
    images: ["/og.png"]
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
  return (
    <html lang="tr">
      <body className="inter_8b85b6d9-module__yhwneW__variable cinzel_decorative_5162d4f4-module__H-QLta__variable">
        <Header />
        <main>{children}</main>
        <Footer />
        <FloatingContacts />
      </body>
    </html>
  );
}
