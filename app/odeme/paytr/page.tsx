import Link from "next/link";

function getToken(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return /^[A-Za-z0-9_-]{10,220}$/.test(value) ? value : "";
}

export default function PaytrPaymentPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = getToken(searchParams.token);

  if (!token) {
    return (
      <main className="payment-page">
        <section className="payment-panel">
          <span className="payment-eyebrow">Ödeme</span>
          <h1>Ödeme başlatılamadı</h1>
          <p>Ödeme oturumu geçersiz görünüyor. Lütfen rezervasyon formunu tekrar gönderin veya otelle iletişime geçin.</p>
          <Link className="booking-link booking-link--solid" href="/rezervasyon">
            Rezervasyona dön
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="payment-page payment-page--iframe">
      <section className="payment-panel payment-panel--wide">
        <span className="payment-eyebrow">Güvenli Ödeme</span>
        <h1>3D Secure ödeme</h1>
        <p>Kart bilgileriniz otel sitesinde saklanmaz. Ödeme işlemi güvenli sağlayıcı ekranında tamamlanır.</p>
        <iframe
          className="payment-iframe"
          src={`https://www.paytr.com/odeme/guvenli/${token}`}
          title="PayTR Güvenli Ödeme"
        />
      </section>
    </main>
  );
}
