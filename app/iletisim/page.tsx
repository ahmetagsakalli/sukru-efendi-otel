import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "İletişim",
  description: "Şükrü Efendi Ottoman Hotel telefon, WhatsApp, e-posta ve konum bilgileri.",
  alternates: {
    canonical: "/iletisim"
  },
  openGraph: {
    title: "İletişim | Şükrü Efendi Ottoman Hotel",
    description: "Rezervasyon, telefon, WhatsApp, e-posta ve Ordu merkez konum bilgileri.",
    url: "/iletisim",
    images: ["/hotel-images/gallery-reception-desk.jpg"]
  }
};

export default function ContactPage() {
  return (
    <div className="page-transition">
      <PageIntro title="Rezervasyon ve bilgi için otelle doğrudan görüşün.">
        Tarih, kişi sayısı ve oda tercihinizi ileterek uygun seçenekleri hızlıca öğrenebilirsiniz.
      </PageIntro>
      <section className="section contact-grid">
        <div className="contact-panel">
          <h2>Doğrudan iletişim</h2>
          <div className="contact-actions">
            <a href={site.phoneHref}>{site.phone}</a>
            <a href="tel:+905524527770">{site.whatsapp}</a>
            <a href={site.whatsappHref}>WhatsApp</a>
            <a href={site.emailHref}>{site.email}</a>
          </div>
          <Link className="booking-link booking-link--solid" href="/iletisim">
            REZERVASYON YAP
          </Link>
        </div>
        <div className="contact-panel" id="konum">
          <h2>Ordu şehir merkezi</h2>
          <p>{site.address}</p>
          <div className="contact-map" aria-label="Şükrü Efendi Ottoman Hotel konumu">
            <iframe
              title="Şükrü Efendi Ottoman Hotel Google Maps konumu"
              src={site.mapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <a className="text-link" href={site.mapHref}>
            Haritada Aç
          </a>
        </div>
      </section>
    </div>
  );
}
