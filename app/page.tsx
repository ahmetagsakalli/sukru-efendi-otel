import Link from "next/link";
import { BookingForm } from "@/components/BookingForm";
import { FeatureHighlights } from "@/components/FeatureHighlights";
import { GalleryStrip } from "@/components/GalleryStrip";
import { HeroServiceRotator } from "@/components/HeroServiceRotator";
import { RoomCard } from "@/components/RoomCard";
import { RoomStats } from "@/components/RoomStats";
import { StructuredData } from "@/components/StructuredData";
import { VisualImage } from "@/components/VisualImage";
import { rooms, services } from "@/data/site";

export default function HomePage() {
  return (
    <div className="page-transition">
      <StructuredData />
      <section className="hero-shell">
        <VisualImage
          className="visual-panel visual-panel--hero"
          src="/hotel-images/hero-facade-night.jpg"
          alt="Şükrü Efendi Ottoman Hotel"
          priority
        />
        <div className="hero-content">
          <div className="hero-copy">
            <h1>
              ŞEHRİN KALBİNDE
              <br />
              <em>LÜKS KONAKLAMA</em>
            </h1>
            <HeroServiceRotator items={services} />
            <p className="hero-lead">
              400 yıllık tarihi bir yapıda, şehrin merkezinde sakin ve özenli bir otel deneyimi.
            </p>
            <div className="hero-actions">
              <Link className="booking-link booking-link--glass" href="#odalar">
                ODALARI KEŞFET
              </Link>
            </div>
          </div>
        </div>
      </section>
      <BookingForm />
      <section className="section rooms-section" id="odalar">
        <div className="section-title">
          <h2>Odalar ve Suitler</h2>
        </div>
        <RoomStats />
        <FeatureHighlights />
        <div className="room-grid">
          {rooms.map((room) => (
            <RoomCard room={room} key={room.slug} />
          ))}
        </div>
      </section>
      <section className="section history-preview">
        <VisualImage
          className="visual-panel visual-panel--facade"
          src="/hotel-images/facade-night-wide.jpg"
          alt="Tarihi doku"
          sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
        />
        <div>
          <h2>Yeni bir bina hissi değil, korunmuş bir zaman duygusu.</h2>
          <p>
            Şükrü Efendi Ottoman Hotel&apos;in karakteri, içinde bulunduğu tarihi yapının sakin
            tavrından gelir. Konaklama, şehir merkezine yakın ama kendi içinde dingin bir alanda
            gerçekleşir.
          </p>
          <Link className="text-link" href="/tarihce">
            Hikayeyi Oku
          </Link>
        </div>
      </section>
      <GalleryStrip />
    </div>
  );
}
