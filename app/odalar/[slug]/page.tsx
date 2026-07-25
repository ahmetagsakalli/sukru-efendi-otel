import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeatureHighlights } from "@/components/FeatureHighlights";
import { RoomCard } from "@/components/RoomCard";
import { VisualImage } from "@/components/VisualImage";
import { getSiteContent } from "@/lib/site-content";

type RoomPageProps = {
  params: {
    slug: string;
  };
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: RoomPageProps): Promise<Metadata> {
  const { rooms, site } = await getSiteContent();
  const room = rooms.find((item) => item.slug === params.slug);

  if (!room) {
    return {};
  }

  return {
    title: room.title,
    description: room.description,
    alternates: {
      canonical: `/odalar/${room.slug}`
    },
    openGraph: {
      title: `${room.title} | ${site.name}`,
      description: room.description,
      url: `/odalar/${room.slug}`,
      images: [room.image]
    }
  };
}

export default async function RoomDetailPage({ params }: RoomPageProps) {
  const { roomFeatures, rooms, site } = await getSiteContent();
  const room = rooms.find((item) => item.slug === params.slug);

  if (!room) {
    notFound();
  }

  const otherRooms = rooms.filter((item) => item.slug !== room.slug);
  const roomMetrics = [
    { label: "Alan", value: room.size },
    { label: "Kapasite", value: room.capacity },
    { label: "Yatak", value: room.bed }
  ];

  return (
    <div className="page-transition">
      <section className="room-detail-hero">
        <VisualImage
          className={`visual-panel visual-panel--${room.tone}`}
          src={room.image}
          alt={room.title}
          priority
        />
        <div className="room-detail-hero__overlay" />
        <div className="room-detail-hero__content">
          <Link className="room-detail-back" href="/odalar">
            Odalara dön
          </Link>
          <p className="room-detail-kicker">{site.name}</p>
          <h1>{room.title}</h1>
          <p>{room.description}</p>
          <div className="room-detail-metrics" aria-label={`${room.title} oda bilgileri`}>
            {roomMetrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
          <div className="room-detail-actions">
            <Link className="booking-link booking-link--glass" href="/#rezervasyon">
              Rezervasyon Yap
            </Link>
          </div>
        </div>
      </section>

      <section className="section room-image-section">
        <div className="section-title section-title--center room-image-section__title">
          <h2>{room.title} fotoğrafları</h2>
        </div>
        <div className="room-image-gallery">
          {room.gallery.map((image, index) => (
            <VisualImage
              key={image}
              className={`room-image-gallery__item${index === 0 ? " room-image-gallery__item--lead" : ""}`}
              src={image}
              alt={`${room.title} fotoğrafı ${index + 1}`}
              sizes={index === 0 ? "100vw" : "(max-width: 760px) 100vw, 33vw"}
            />
          ))}
        </div>
      </section>

      <section className="section room-detail-panel">
        <div className="room-detail-panel__text">
          <span className="room-detail-panel__eyebrow">Oda deneyimi</span>
          <p>{room.longDescription}</p>
        </div>
      </section>

      <section className="section detail-feature-section">
        <div className="section-title section-title--center">
          <h2>Odada öne çıkan detaylar</h2>
        </div>
        <FeatureHighlights features={roomFeatures} />
      </section>

      <section className="section room-detail-summary">
        <div>
          <h2>Oda imkanları</h2>
          <ul className="amenity-list">
            {room.amenities.map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
          </ul>
        </div>
        <aside className="room-detail-reservation">
          <p>Doğrudan rezervasyon</p>
          <h2>{room.price}</h2>
          <Link className="booking-link booking-link--solid" href="/#rezervasyon">
            Rezervasyon Yap
          </Link>
        </aside>
      </section>

      <section className="section room-detail-other">
        <div className="section-title">
          <h2>Diğer oda seçenekleri</h2>
        </div>
        <div className="room-detail-other__grid">
          {otherRooms.map((item) => (
            <RoomCard room={item} key={item.slug} />
          ))}
        </div>
      </section>
    </div>
  );
}
