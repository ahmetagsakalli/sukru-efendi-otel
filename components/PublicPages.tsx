import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingForm } from "@/components/BookingForm";
import { FeatureHighlights } from "@/components/FeatureHighlights";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { GalleryStrip } from "@/components/GalleryStrip";
import { HeroServiceRotator } from "@/components/HeroServiceRotator";
import { PageIntro } from "@/components/PageIntro";
import { RoomCard } from "@/components/RoomCard";
import { RoomStats } from "@/components/RoomStats";
import { StructuredData } from "@/components/StructuredData";
import { VisualImage } from "@/components/VisualImage";
import { getBookingInitialValues, type BookingSearchParams } from "@/lib/booking-url";
import {
  getBookingHref,
  getPublicCopy,
  getRouteHref,
  getRoomsSectionHref,
  interpolate,
  localizeSiteContent,
  type PublicLocale
} from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function PublicHomePage({ locale }: { locale: PublicLocale }) {
  const content = localizeSiteContent(await getSiteContent(), locale);
  const { pages, rooms, services } = content;
  const copy = getPublicCopy(locale);
  const serviceLabelPrefix =
    locale === "en" ? "Hotel services" : locale === "de" ? "Hotelleistungen" : "Otel hizmetleri";

  return (
    <div className="page-transition">
      <StructuredData content={content} locale={locale} />
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
            <HeroServiceRotator items={services} label={`${serviceLabelPrefix}: ${services.join(", ")}`} />
            <p className="hero-lead">{pages.home.heroLead}</p>
            <div className="hero-actions">
              <Link className="booking-link booking-link--glass" href={getRoomsSectionHref(locale)}>
                {copy.home.exploreRooms}
              </Link>
            </div>
          </div>
        </div>
      </section>
      <BookingForm rooms={rooms} locale={locale} />
      <section className="section rooms-section" id="odalar">
        <div className="section-title">
          <h2>{copy.home.roomsTitle}</h2>
        </div>
        <RoomStats rooms={rooms} locale={locale} />
        <FeatureHighlights features={content.roomFeatures} locale={locale} />
        <div className="room-grid">
          {rooms.map((room) => (
            <RoomCard room={room} locale={locale} key={room.slug} />
          ))}
        </div>
      </section>
      <section className="section history-preview">
        <VisualImage
          className="visual-panel visual-panel--facade"
          src={pages.home.historyImage}
          alt={copy.home.historyImageAlt}
          sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
        />
        <div>
          <h2>{pages.home.historyTitle}</h2>
          <p>{pages.home.historyText}</p>
          <Link className="text-link" href={getRouteHref(locale, "history")}>
            {copy.home.storyLink}
          </Link>
        </div>
      </section>
      <GalleryStrip items={content.galleryItems} locale={locale} />
    </div>
  );
}

export async function PublicRoomsPage({ locale }: { locale: PublicLocale }) {
  const { pages, roomFeatures, rooms } = localizeSiteContent(await getSiteContent(), locale);

  return (
    <div className="page-transition">
      <PageIntro title={pages.rooms.title}>{pages.rooms.body}</PageIntro>
      <section className="section">
        <FeatureHighlights features={roomFeatures} locale={locale} />
        <div className="room-grid room-grid--wide">
          {rooms.map((room) => (
            <RoomCard room={room} locale={locale} key={room.slug} />
          ))}
        </div>
      </section>
    </div>
  );
}

export async function PublicBookingPage({
  locale,
  searchParams
}: {
  locale: PublicLocale;
  searchParams?: BookingSearchParams;
}) {
  const content = localizeSiteContent(await getSiteContent(), locale);
  const { rooms } = content;
  const copy = getPublicCopy(locale);
  const initialValues = getBookingInitialValues(searchParams, rooms, locale);

  return (
    <div className="page-transition">
      <PageIntro kicker={copy.bookingPage.kicker} title={copy.bookingPage.title}>
        {copy.bookingPage.body}
      </PageIntro>
      <BookingForm
        rooms={rooms}
        locale={locale}
        initialValues={initialValues}
        sectionClassName="booking-page-reservation"
      />
      <section className="section booking-page-rooms">
        <div className="section-title section-title--center">
          <h2>{copy.home.roomsTitle}</h2>
        </div>
        <div className="room-grid room-grid--wide">
          {rooms.map((room) => (
            <RoomCard room={room} locale={locale} key={room.slug} />
          ))}
        </div>
      </section>
    </div>
  );
}

export async function PublicRoomDetailPage({
  locale,
  originalSlug
}: {
  locale: PublicLocale;
  originalSlug: string;
}) {
  const { roomFeatures, rooms, site } = localizeSiteContent(await getSiteContent(), locale);
  const room = rooms.find((item) => item.slug === originalSlug);
  const copy = getPublicCopy(locale);

  if (!room) {
    notFound();
  }

  const otherRooms = rooms.filter((item) => item.slug !== room.slug);
  const roomMetrics = [
    { label: copy.roomDetail.area, value: room.size },
    { label: copy.roomDetail.capacity, value: room.capacity },
    { label: copy.roomDetail.bed, value: room.bed }
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
          <Link className="room-detail-back" href={getRouteHref(locale, "rooms")}>
            {copy.roomDetail.back}
          </Link>
          <p className="room-detail-kicker">{site.name}</p>
          <h1>{room.title}</h1>
          <p>{room.description}</p>
          <div
            className="room-detail-metrics"
            aria-label={interpolate(copy.roomDetail.metricsAria, { room: room.title })}
          >
            {roomMetrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
          <div className="room-detail-actions">
            <Link className="booking-link booking-link--glass" href={getBookingHref(locale, { roomSlug: room.slug })}>
              {copy.roomDetail.booking}
            </Link>
          </div>
        </div>
      </section>

      <section className="section room-image-section">
        <div className="section-title section-title--center room-image-section__title">
          <h2>{interpolate(copy.roomDetail.photosTitle, { room: room.title })}</h2>
        </div>
        <div className="room-image-gallery">
          {room.gallery.map((image, index) => (
            <VisualImage
              key={image}
              className={`room-image-gallery__item${index === 0 ? " room-image-gallery__item--lead" : ""}`}
              src={image}
              alt={interpolate(copy.roomDetail.photoAlt, { room: room.title, index: index + 1 })}
              sizes={index === 0 ? "100vw" : "(max-width: 760px) 100vw, 33vw"}
            />
          ))}
        </div>
      </section>

      <section className="section room-detail-panel">
        <div className="room-detail-panel__text">
          <span className="room-detail-panel__eyebrow">{copy.roomDetail.experience}</span>
          <p>{room.longDescription}</p>
        </div>
      </section>

      <section className="section detail-feature-section">
        <div className="section-title section-title--center">
          <h2>{copy.roomDetail.featureTitle}</h2>
        </div>
        <FeatureHighlights features={roomFeatures} locale={locale} />
      </section>

      <section className="section room-detail-summary">
        <div>
          <h2>{copy.roomDetail.amenitiesTitle}</h2>
          <ul className="amenity-list">
            {room.amenities.map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
          </ul>
        </div>
        <aside className="room-detail-reservation">
          <p>{copy.roomDetail.directBooking}</p>
          <h2>{room.price}</h2>
          <Link className="booking-link booking-link--solid" href={getBookingHref(locale, { roomSlug: room.slug })}>
            {copy.roomDetail.booking}
          </Link>
        </aside>
      </section>

      <section className="section room-detail-other">
        <div className="section-title">
          <h2>{copy.roomDetail.otherRooms}</h2>
        </div>
        <div className="room-detail-other__grid">
          {otherRooms.map((item) => (
            <RoomCard room={item} locale={locale} key={item.slug} />
          ))}
        </div>
      </section>
    </div>
  );
}

export async function PublicGalleryPage({ locale }: { locale: PublicLocale }) {
  const { galleryItems, pages } = localizeSiteContent(await getSiteContent(), locale);

  return (
    <div className="page-transition">
      <PageIntro title={pages.gallery.title}>{pages.gallery.body}</PageIntro>
      <GalleryLightbox items={galleryItems} locale={locale} />
    </div>
  );
}

export async function PublicContactPage({ locale }: { locale: PublicLocale }) {
  const { pages, site } = localizeSiteContent(await getSiteContent(), locale);
  const copy = getPublicCopy(locale);

  return (
    <div className="page-transition">
      <PageIntro title={pages.contact.title}>{pages.contact.body}</PageIntro>
      <section className="section contact-grid">
        <div className="contact-panel">
          <h2>{pages.contact.contactTitle}</h2>
          <div className="contact-actions">
            <a href={site.phoneHref}>{site.phone}</a>
            <a href={site.whatsappHref}>{site.whatsapp}</a>
            <a href={site.whatsappHref}>{copy.contact.whatsapp}</a>
            <a href={site.emailHref}>{site.email}</a>
          </div>
          <Link className="booking-link booking-link--solid" href={getBookingHref(locale)}>
            {copy.nav.booking}
          </Link>
        </div>
        <div className="contact-panel" id="konum">
          <h2>{pages.contact.locationTitle}</h2>
          <p>{site.address}</p>
          <div className="contact-map" aria-label={copy.contact.mapAria}>
            <iframe
              title={copy.contact.mapTitle}
              src={site.mapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <a className="text-link" href={site.mapHref}>
            {copy.footer.openMap}
          </a>
        </div>
      </section>
    </div>
  );
}

export async function PublicHistoryPage({ locale }: { locale: PublicLocale }) {
  const { pages, site } = localizeSiteContent(await getSiteContent(), locale);

  return (
    <div className="page-transition">
      <PageIntro title={pages.history.title}>{pages.history.body}</PageIntro>
      <section className="section split-feature">
        <VisualImage
          className="visual-panel visual-panel--facade"
          src={pages.history.image}
          alt={`${site.name} ${pages.history.title}`}
          sizes="(max-width: 760px) 100vw, 50vw"
        />
        <div className="timeline">
          {pages.history.timeline.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
