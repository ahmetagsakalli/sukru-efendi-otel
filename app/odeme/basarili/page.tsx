import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <main className="payment-page">
      <section className="payment-panel">
        <span className="payment-eyebrow">Ödeme Alındı</span>
        <h1>Rezervasyon ödemeniz alındı</h1>
        <p>Ödeme sonucu sisteme ulaştığında rezervasyon kaydınız otomatik olarak güncellenecek. Otel gerekli durumda sizinle iletişime geçebilir.</p>
        <Link className="booking-link booking-link--solid" href="/">
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}
