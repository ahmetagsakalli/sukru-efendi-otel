import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";
import { VisualImage } from "@/components/VisualImage";

export const metadata: Metadata = {
  title: "Tarihçe",
  description: "Şükrü Efendi Ottoman Hotel tarihi yapısı ve korunmuş atmosferi.",
  alternates: {
    canonical: "/tarihce"
  },
  openGraph: {
    title: "Tarihçe | Şükrü Efendi Ottoman Hotel",
    description: "Otelin tarihi yapısına ve korunmuş atmosferine kısa bakış.",
    url: "/tarihce",
    images: ["/hotel-images/facade-night-wide.jpg"]
  }
};

export default function HistoryPage() {
  return (
    <div className="page-transition">
      <PageIntro title="Yeni bir bina hissi değil, korunmuş bir zaman duygusu.">
        Otelin karakteri, içinde bulunduğu tarihi yapının ölçülü ve sakin tavrından gelir. Amaç,
        yapının geçmişini dekor gibi göstermek değil; konaklamanın doğal bir parçası haline
        getirmektir.
      </PageIntro>
      <section className="section split-feature">
        <VisualImage
          className="visual-panel visual-panel--facade"
          src="/hotel-images/facade-night-wide.jpg"
          alt="Şükrü Efendi Ottoman Hotel tarihi cephe"
          sizes="(max-width: 760px) 100vw, 50vw"
        />
        <div className="timeline">
          <p>Yapının belleği korunur; yeni eklenen her detay bu ölçüye göre düşünülür.</p>
          <p>Şehir içindeki konum, yürüyerek ulaşılabilen bir konaklama düzeni sağlar.</p>
          <p>Güncel konfor, tarihi yapının ritmini bozmadan odalara ve ortak alanlara taşınır.</p>
        </div>
      </section>
    </div>
  );
}
