import Link from "next/link";

export default function PaymentFailedPage() {
  return (
    <main className="payment-page">
      <section className="payment-panel">
        <span className="payment-eyebrow">Ödeme Tamamlanmadı</span>
        <h1>Ödeme işlemi tamamlanamadı</h1>
        <p>Kart doğrulaması veya ödeme onayı başarısız oldu. Tekrar deneyebilir ya da otelle doğrudan iletişime geçebilirsiniz.</p>
        <div className="payment-actions">
          <Link className="booking-link booking-link--solid" href="/#rezervasyon">
            Tekrar dene
          </Link>
          <Link className="booking-link booking-link--outline" href="/iletisim">
            İletişim
          </Link>
        </div>
      </section>
    </main>
  );
}
