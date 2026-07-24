"use client";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="page-intro">
      <p className="page-intro__kicker">Şükrü Efendi Ottoman Hotel</p>
      <h1>Bir şey ters gitti.</h1>
      <p>Sayfayı tekrar yükleyerek devam edebilirsiniz.</p>
      <button className="booking-link booking-link--solid" type="button" onClick={reset}>
        Tekrar Dene
      </button>
    </section>
  );
}
