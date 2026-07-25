import type { Metadata } from "next";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { PageIntro } from "@/components/PageIntro";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Galeri",
  description: "Şükrü Efendi Ottoman Hotel dış cephe, resepsiyon, oda ve detay fotoğrafları.",
  alternates: {
    canonical: "/galeri"
  },
  openGraph: {
    title: "Galeri | Şükrü Efendi Ottoman Hotel",
    description: "Şükrü Efendi Ottoman Hotel dış cephe, resepsiyon, oda ve detay fotoğrafları.",
    url: "/galeri",
    images: ["/hotel-images/hero-facade-night.webp"]
  }
};

export default async function GalleryPage() {
  const { galleryItems, pages } = await getSiteContent();

  return (
    <div className="page-transition">
      <PageIntro title={pages.gallery.title}>{pages.gallery.body}</PageIntro>
      <GalleryLightbox items={galleryItems} />
    </div>
  );
}
