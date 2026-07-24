import Link from "next/link";
import { site } from "@/data/site";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div>
          <p className="footer-kicker">{site.name}</p>
          <p className="footer-title">Ordu&apos;nun merkezinde, tarihi bir yapının içinde sakin bir durak.</p>
        </div>
        <div className="footer-links">
          <Link href="/odalar">ODALAR</Link>
          <Link href="/#hizmetler">HİZMETLER</Link>
          <Link href="/tarihce">TARİHÇE</Link>
          <Link href="/galeri">GALERİ</Link>
          <Link href="/iletisim">İLETİŞİM</Link>
        </div>
        <div className="footer-contact">
          <a href={site.phoneHref}>{site.phone}</a>
          <a href={site.emailHref}>{site.email}</a>
          <a href={site.mapHref} target="_blank" rel="noreferrer">
            Haritada Aç
          </a>
          <Link className="booking-link booking-link--outline" href="/iletisim">
            REZERVASYON YAP
          </Link>
        </div>
      </div>
      <div className="footer-location">
        <div className="footer-location__copy">
          <p className="footer-kicker">Konum</p>
          <h2>Google Maps üzerinde kolay ulaşım.</h2>
          <address>{site.address}</address>
          <a className="text-link" href={site.mapHref} target="_blank" rel="noreferrer">
            Haritada Aç
          </a>
        </div>
        <div className="footer-map" aria-label="Google Maps konumu">
          <iframe
            title="Şükrü Efendi Ottoman Hotel Google Maps konumu"
            src={site.mapEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </footer>
  );
}
