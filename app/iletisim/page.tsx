import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { getSiteContent } from "@/lib/site-content";

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
    images: ["/hotel-images/gallery-reception-desk.webp"]
  }
};

export default async function ContactPage() {
  const { pages, site } = await getSiteContent();

  return (
    <div className="page-transition">
      <PageIntro title={pages.contact.title}>{pages.contact.body}</PageIntro>
      <section className="section contact-grid">
        <div className="contact-panel">
          <h2>{pages.contact.contactTitle}</h2>
          <div className="contact-actions">
            <a href={site.phoneHref}>{site.phone}</a>
            <a href={site.whatsappHref}>{site.whatsapp}</a>
            <a href={site.whatsappHref}>WhatsApp</a>
            <a href={site.emailHref}>{site.email}</a>
          </div>
          <Link className="booking-link booking-link--solid" href="/#rezervasyon">
            REZERVASYON YAP
          </Link>
        </div>
        <div className="contact-panel" id="konum">
          <h2>{pages.contact.locationTitle}</h2>
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
