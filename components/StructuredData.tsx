import { BOOKING_CURRENCY, parseRoomPrice } from "@/lib/booking";
import {
  defaultLocale,
  getBookingHref,
  getHomeHref,
  getRoomHref,
  publicLocales,
  type PublicLocale
} from "@/lib/i18n";
import type { SiteContent } from "@/lib/site-content-schema";

function absoluteUrl(baseUrl: string, path: string) {
  if (path === "/") return baseUrl;
  return `${baseUrl}${path}`;
}

export function StructuredData({
  content,
  locale = defaultLocale
}: {
  content: SiteContent;
  locale?: PublicLocale;
}) {
  const { rooms, roomFeatures, site, services } = content;
  const homeUrl = absoluteUrl(site.canonicalUrl, getHomeHref(locale));
  const data = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    "@id": `${site.canonicalUrl}/#hotel`,
    name: site.name,
    url: homeUrl,
    description: site.description,
    image: [
      `${site.canonicalUrl}/hotel-images/hero-facade-night.webp`,
      `${site.canonicalUrl}/hotel-images/gallery-reception-desk.webp`,
      `${site.canonicalUrl}/hotel-images/gallery-room-wide.webp`
    ],
    logo: `${site.canonicalUrl}/brand/sukru-efendi-logo.webp`,
    telephone: site.phone,
    email: site.email,
    numberOfRooms: 18,
    priceRange: "₺₺",
    currenciesAccepted: "TRY",
    hasMap: site.mapHref,
    sameAs: ["https://www.instagram.com/sukruefendiottomanhotel/"],
    address: {
      "@type": "PostalAddress",
      streetAddress: "Şarkiye Mahallesi Osman Paşa Caddesi, Şükrü Efendi Sk.",
      addressLocality: "Altınordu",
      addressRegion: "Ordu",
      postalCode: "52200",
      addressCountry: "TR"
    },
    amenityFeature: [...services, ...roomFeatures.map((feature) => feature.title)].map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true
    })),
    contactPoint: {
      "@type": "ContactPoint",
      telephone: site.phone,
      contactType: "reservations",
      areaServed: "TR",
      availableLanguage: publicLocales
    },
    potentialAction: {
      "@type": "ReserveAction",
      target: absoluteUrl(site.canonicalUrl, getBookingHref(locale))
    },
    containsPlace: rooms.map((room) => ({
      "@type": "HotelRoom",
      name: room.title,
      description: room.description,
      numberOfRooms: room.count,
      occupancy: room.capacity,
      floorSize: room.size,
      offers: {
        "@type": "Offer",
        availability: room.count > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
        price: parseRoomPrice(room.price),
        priceCurrency: BOOKING_CURRENCY,
        url: absoluteUrl(site.canonicalUrl, getRoomHref(room.slug, locale))
      }
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
