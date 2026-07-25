export type Room = {
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  count: number;
  size: string;
  capacity: string;
  bed: string;
  price: string;
  image: string;
  tone: "room" | "suite" | "family";
  gallery: string[];
  amenities: string[];
};

export const site = {
  name: "Şükrü Efendi Ottoman Hotel",
  shortName: "Şükrü Efendi",
  description:
    "Ordu'nun merkezinde, tarihi bir yapının sakinliğini şehir hayatına yakın bir konaklama deneyimiyle buluşturan butik otel.",
  phone: "+90 452 222 52 22",
  phoneHref: "tel:+904522225222",
  whatsapp: "+90 552 452 77 70",
  whatsappHref: "https://wa.me/905524527770",
  email: "info@sukruefendihotel.com",
  emailHref: "mailto:info@sukruefendihotel.com",
  address:
    "Şarkiye Mahallesi Osman Paşa Caddesi, Şükrü Efendi Sk., 52200 Altınordu / Ordu",
  mapHref: "https://maps.google.com/?cid=11469907423840199699&hl=tr-TR",
  mapEmbed:
    "https://maps.google.com/?cid=11469907423840199699&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAMYASAF&hl=tr-TR&source=embed&output=embed",
  canonicalUrl: "https://sukruefendihotel.com"
};

export const services = [
  "Ordu şehir merkezinde konum",
  "24 saat resepsiyon",
  "Ücretsiz Wi-Fi",
  "Günlük temizlik",
  "Bagaj muhafazası",
  "Avlu ve lobi alanları",
  "Özel karşılama hizmeti",
  "Transfer desteği"
];

export const roomFeatures = [
  {
    icon: "smart-entry",
    title: "Akıllı Giriş",
    description:
      "Oda erişimi ve giriş süreci pratik, güvenli ve resepsiyon desteğiyle hızlı ilerler."
  },
  {
    icon: "safe",
    title: "Oda İçi Kasa",
    description:
      "Kişisel eşyalarınızı odanızdan çıkmadan güvenle saklayabileceğiniz kasa bulunur."
  },
  {
    icon: "wifi",
    title: "Ücretsiz Wi-Fi",
    description: "Odalarda ve ortak alanlarda ücretsiz internet erişimi sunulur."
  }
] as const;

export const rooms: Room[] = [
  {
    slug: "standart-oda",
    title: "Standart Oda",
    description:
      "Merkezde kısa konaklamalar ve iş seyahatleri için sade, rahat ve iyi düşünülmüş bir oda.",
    longDescription:
      "Standart odalar, gün içinde şehre karışıp akşam sakin bir odaya dönmek isteyen misafirler için hazırlandı. Temiz çizgiler, pratik kullanım ve güncel konfor bir arada tutuldu.",
    count: 14,
    size: "24 m²",
    capacity: "3 kişiye kadar",
    bed: "Tek veya çift kişilik yatak",
    price: "₺2.900",
    image: "/hotel-images/rooms/standard/standard-room-twin.webp",
    tone: "room",
    gallery: [
      "/hotel-images/rooms/standard/standard-room-twin.webp",
      "/hotel-images/rooms/standard/standard-room-wide.webp",
      "/hotel-images/rooms/standard/standard-room-double-stone.webp",
      "/hotel-images/rooms/standard/standard-room-city-view.webp",
      "/hotel-images/rooms/standard/standard-room-bathroom.webp",
      "/hotel-images/rooms/standard/standard-room-safe-minibar.webp"
    ],
    amenities: [
      "Akıllı giriş",
      "Oda içi kasa",
      "Ücretsiz Wi-Fi",
      "Minibar",
      "Klima",
      "Saç kurutma makinesi"
    ]
  },
  {
    slug: "suit-oda",
    title: "Suit Oda",
    description:
      "Daha ferah bir oda, uzun konaklama veya özel bir şehir kaçamağı için dengeli bir seçenek.",
    longDescription:
      "Suit odalar, otelin tarihi dokusuna yakışan sakin bir atmosferle daha geniş hareket alanı sunar. Oturma köşesi, jakuzi alanı ve oda içi konfor detaylarıyla konaklamayı yalnızca geceleme değil, dinlenme zamanına dönüştürür.",
    count: 2,
    size: "38 m²",
    capacity: "3 kişiye kadar",
    bed: "Geniş yatak ve oturma alanı",
    price: "₺4.600",
    image: "/hotel-images/rooms/suite/suite-room-bathroom-view.webp",
    tone: "suite",
    gallery: [
      "/hotel-images/rooms/suite/suite-room-bathroom-view.webp",
      "/hotel-images/rooms/suite/suite-room-jacuzzi-wide.webp",
      "/hotel-images/rooms/suite/suite-jacuzzi-window.webp",
      "/hotel-images/rooms/suite/suite-bathroom-wide.webp",
      "/hotel-images/rooms/suite/suite-room-headboard.webp",
      "/hotel-images/rooms/suite/suite-wardrobe-safe.webp"
    ],
    amenities: [
      "Akıllı giriş",
      "Oda içi kasa",
      "Ücretsiz Wi-Fi",
      "Jakuzi alanı",
      "Oturma köşesi",
      "Minibar"
    ]
  },
  {
    slug: "aile-odalari",
    title: "Aile Odaları",
    description:
      "Aileler ve birlikte seyahat eden misafirler için kullanışlı, sakin ve merkezde bir alan.",
    longDescription:
      "Aile odaları, aynı şehir programını paylaşan misafirlerin konforunu düşünür. Günlük ihtiyaçlara yakın, merkeze yürüme mesafesinde ve otel hizmetlerine kolay erişimli bir konaklama sunar.",
    count: 2,
    size: "42 m²",
    capacity: "4 kişiye kadar",
    bed: "Aile kullanımına uygun düzen",
    price: "₺5.200",
    image: "/hotel-images/rooms/family/family-room-main.webp",
    tone: "family",
    gallery: [
      "/hotel-images/rooms/family/family-room-main.webp",
      "/hotel-images/rooms/family/family-room-wide.webp",
      "/hotel-images/rooms/family/family-room-bed-sofa.webp",
      "/hotel-images/rooms/family/family-bathroom-wide.webp",
      "/hotel-images/rooms/family/family-safe.webp",
      "/hotel-images/rooms/family/family-smart-entry.webp"
    ],
    amenities: [
      "Akıllı giriş",
      "Oda içi kasa",
      "Ücretsiz Wi-Fi",
      "Aile kullanımına uygun düzen",
      "Klima",
      "Günlük temizlik"
    ]
  }
];

export const galleryItems = [
  { title: "Dış cephe", tone: "facade", image: "/hotel-images/hero-facade-night.webp" },
  { title: "Oda geniş görünüm", tone: "room", image: "/hotel-images/gallery-room-suite-wide.webp" },
  { title: "Taş duvar ve perde", tone: "suite", image: "/hotel-images/gallery-window-curtain.webp" },
  { title: "Resepsiyon", tone: "courtyard", image: "/hotel-images/gallery-reception-desk.webp" },
  { title: "Şehir merkezinde cephe", tone: "facade", image: "/hotel-images/gallery-city-center.webp" },
  { title: "Oda kartı", tone: "detail", image: "/hotel-images/gallery-room-card.webp" },
  { title: "Gece cephe", tone: "city", image: "/hotel-images/gallery-facade-night-new.webp" },
  { title: "Oda içi kasa", tone: "suite", image: "/hotel-images/gallery-safe-close.webp" },
  { title: "Köşe cephe", tone: "facade", image: "/hotel-images/gallery-facade-corner-day.webp" },
  { title: "Aydınlatma detayı", tone: "detail", image: "/hotel-images/gallery-lamps-painting.webp" },
  { title: "Oda üst görünüm", tone: "room", image: "/hotel-images/gallery-room-upper-view.webp" },
  { title: "Oda düzeni", tone: "room", image: "/hotel-images/gallery-room-wide.webp" },
  { title: "Oda ikramları", tone: "family", image: "/hotel-images/gallery-amenities.webp" },
  { title: "Banyo", tone: "family", image: "/hotel-images/bathroom.webp" },
  { title: "Karşılama", tone: "breakfast", image: "/hotel-images/key-welcome.webp" },
  { title: "Google değerlendirme", tone: "detail", image: "/hotel-images/gallery-google-review.webp" }
] as const;
