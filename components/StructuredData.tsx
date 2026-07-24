import { rooms, roomFeatures, site, services } from "@/data/site";

export function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    "@id": `${site.canonicalUrl}/#hotel`,
    name: site.name,
    url: site.canonicalUrl,
    description: site.description,
    image: [
      `${site.canonicalUrl}/hotel-images/hero-facade-night.jpg`,
      `${site.canonicalUrl}/hotel-images/gallery-reception-desk.jpg`,
      `${site.canonicalUrl}/hotel-images/gallery-room-wide.jpg`
    ],
    logo: `${site.canonicalUrl}/brand/sukru-efendi-logo.png`,
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
      availableLanguage: ["tr"]
    },
    containsPlace: rooms.map((room) => ({
      "@type": "HotelRoom",
      name: room.title,
      description: room.description,
      numberOfRooms: room.count,
      occupancy: room.capacity,
      floorSize: room.size
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
