import Link from "next/link";
import { BookingForm } from "@/components/BookingForm";
import { FeatureHighlights } from "@/components/FeatureHighlights";
import { GalleryStrip } from "@/components/GalleryStrip";
import { HeroServiceRotator } from "@/components/HeroServiceRotator";
import { RoomCard } from "@/components/RoomCard";
import { RoomStats } from "@/components/RoomStats";
import { StructuredData } from "@/components/StructuredData";
import { VisualImage } from "@/components/VisualImage";
import { getSiteContent } from "@/lib/site-content";

export default async function HomePage() {
  const content = await getSiteContent();
  const { pages, rooms, services } = content;

  return (
    <div className="page-transition">
      <StructuredData content={content} />
      <section className="hero-shell">
        <VisualImage
          className="visual-panel visual-panel--hero"
          src={pages.home.heroImage}
          alt={content.site.name}
          priority
        />
        <div className="hero-content">
          <div className="hero-copy">
            <h1>
              {pages.home.heroTitle}
              <br />
              <em>{pages.home.heroEmphasis}</em>
            </h1>
            <HeroServiceRotator items={services} />
            <p className="hero-lead">{pages.home.heroLead}</p>
            <div className="hero-actions">
              <Link className="booking-link booking-link--glass" href="#odalar">
                ODALARI KEŞFET
              </Link>
            </div>
          </div>
        </div>
      </section>
      <BookingForm rooms={rooms} />
      <section className="section rooms-section" id="odalar">
        <div className="section-title">
          <h2>Odalar ve Suitler</h2>
        </div>
        <RoomStats rooms={rooms} />
        <FeatureHighlights features={content.roomFeatures} />
        <div className="room-grid">
          {rooms.map((room) => (
            <RoomCard room={room} key={room.slug} />
          ))}
        </div>
      </section>
      <section className="section history-preview">
        <VisualImage
          className="visual-panel visual-panel--facade"
          src={pages.home.historyImage}
          alt="Tarihi doku"
          sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
        />
        <div>
          <h2>{pages.home.historyTitle}</h2>
          <p>{pages.home.historyText}</p>
          <Link className="text-link" href="/tarihce">
            Hikayeyi Oku
          </Link>
        </div>
      </section>
      <GalleryStrip items={content.galleryItems} />
    </div>
  );
}
