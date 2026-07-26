import Link from "next/link";

function safeParam(value: unknown) {
  return typeof value === "string" ? value : "";
}

export default function MockPaymentPage({
  searchParams
}: {
  searchParams: { reference?: string; reservationId?: string; token?: string };
}) {
  const reference = safeParam(searchParams.reference);
  const reservationId = safeParam(searchParams.reservationId);
  const token = safeParam(searchParams.token);
  const isValid = Boolean(reference && reservationId && token);

  return (
    <main className="payment-page">
      <section className="payment-panel">
        <span className="payment-eyebrow">Test Ödeme</span>
        <h1>Mock ödeme ekranı</h1>
        <p>Bu ekran sadece VPS/local kurulum testi içindir. Canlıda `PAYMENT_PROVIDER=paytr` kullanılmalı.</p>
        {isValid ? (
          <div className="payment-actions">
            <form action="/api/payments/mock/complete" method="post">
              <input name="reservationId" type="hidden" value={reservationId} />
              <input name="reference" type="hidden" value={reference} />
              <input name="token" type="hidden" value={token} />
              <input name="result" type="hidden" value="success" />
              <button className="booking-link booking-link--solid" type="submit">
                Başarılı Ödeme Simüle Et
              </button>
            </form>
            <form action="/api/payments/mock/complete" method="post">
              <input name="reservationId" type="hidden" value={reservationId} />
              <input name="reference" type="hidden" value={reference} />
              <input name="token" type="hidden" value={token} />
              <input name="result" type="hidden" value="failed" />
              <button className="booking-link booking-link--outline" type="submit">
                Başarısız Ödeme Simüle Et
              </button>
            </form>
          </div>
        ) : (
          <Link className="booking-link booking-link--solid" href="/rezervasyon">
            Rezervasyona dön
          </Link>
        )}
      </section>
    </main>
  );
}
