import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";
import { VisualImage } from "@/components/VisualImage";
import { galleryItems } from "@/data/site";

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
    images: ["/hotel-images/hero-facade-night.jpg"]
  }
};

export default function GalleryPage() {
  return (
    <div className="page-transition">
      <PageIntro title="Otelin dokusunu taşıyan kareler.">
        Dış cepheden resepsiyona, oda detaylarından ortak alanlara kadar otelin atmosferini gösteren
        seçilmiş fotoğraflar.
      </PageIntro>
      <section className="section gallery-grid">
        {galleryItems.map((item) => (
          <VisualImage
            key={item.image}
            className={`visual-panel visual-panel--${item.tone}`}
            src={item.image}
            alt={item.title}
            sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
          />
        ))}
      </section>
    </div>
  );
}
