import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page-intro">
      <p className="page-intro__kicker">Şükrü Efendi Ottoman Hotel</p>
      <h1>Sayfa bulunamadı.</h1>
      <p>Aradığınız sayfa taşınmış veya yayından kaldırılmış olabilir.</p>
      <Link className="booking-link booking-link--solid" href="/">
        Ana Sayfaya Dön
      </Link>
    </section>
  );
}
