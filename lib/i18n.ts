import type { Metadata } from "next";
import type { GalleryItem, Room, RoomFeature, SiteContent } from "@/lib/site-content-schema";

export const publicLocales = ["tr", "en", "de"] as const;
export type PublicLocale = (typeof publicLocales)[number];

export const defaultLocale: PublicLocale = "tr";

export const localeLabels: Record<PublicLocale, { short: string; native: string; aria: string }> = {
  tr: { short: "TR", native: "Türkçe", aria: "Türkçe diline geç" },
  en: { short: "EN", native: "English", aria: "Switch to English" },
  de: { short: "DE", native: "Deutsch", aria: "Zur deutschen Sprache wechseln" }
};

export type RouteKey = "home" | "rooms" | "history" | "gallery" | "contact" | "booking";

const routeSegments: Record<PublicLocale, Record<Exclude<RouteKey, "home">, string>> = {
  tr: {
    rooms: "odalar",
    history: "tarihce",
    gallery: "galeri",
    contact: "iletisim",
    booking: "rezervasyon"
  },
  en: {
    rooms: "rooms",
    history: "history",
    gallery: "gallery",
    contact: "contact",
    booking: "booking"
  },
  de: {
    rooms: "zimmer",
    history: "geschichte",
    gallery: "galerie",
    contact: "kontakt",
    booking: "reservierung"
  }
};

const roomSlugTranslations: Record<PublicLocale, Record<string, string>> = {
  tr: {
    "standart-oda": "standart-oda",
    "suit-oda": "suit-oda",
    "aile-odalari": "aile-odalari"
  },
  en: {
    "standart-oda": "standard-room",
    "suit-oda": "suite-room",
    "aile-odalari": "family-rooms"
  },
  de: {
    "standart-oda": "standardzimmer",
    "suit-oda": "suite-zimmer",
    "aile-odalari": "familienzimmer"
  }
};

const localizedRoomSlugs = Object.fromEntries(
  publicLocales.map((locale) => [
    locale,
    Object.fromEntries(Object.entries(roomSlugTranslations[locale]).map(([original, localized]) => [localized, original]))
  ])
) as Record<PublicLocale, Record<string, string>>;

export function isPublicLocale(value: string | undefined): value is PublicLocale {
  return Boolean(value && publicLocales.includes(value as PublicLocale));
}

export function getLocaleFromPathname(pathname: string): PublicLocale {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/de" || pathname.startsWith("/de/")) return "de";
  return defaultLocale;
}

export function getLocalePrefix(locale: PublicLocale) {
  return locale === defaultLocale ? "" : `/${locale}`;
}

export function getHomeHref(locale: PublicLocale) {
  return locale === defaultLocale ? "/" : `/${locale}`;
}

export function getRouteHref(locale: PublicLocale, route: RouteKey) {
  if (route === "home") return getHomeHref(locale);

  return `${getLocalePrefix(locale)}/${routeSegments[locale][route]}`;
}

export function getBookingHref(
  locale: PublicLocale,
  params?: {
    adults?: number | string;
    checkIn?: string;
    checkOut?: string;
    children?: number | string;
    roomSlug?: string;
  }
) {
  const href = getRouteHref(locale, "booking");

  if (!params) return href;

  const query = new URLSearchParams();

  if (params.checkIn) query.set("checkIn", params.checkIn);
  if (params.checkOut) query.set("checkOut", params.checkOut);
  if (params.roomSlug) query.set("room", getLocalizedRoomSlug(params.roomSlug, locale));
  if (params.adults) query.set("adults", String(params.adults));
  if (params.children) query.set("children", String(params.children));

  const queryString = query.toString();
  return queryString ? `${href}?${queryString}` : href;
}

export function getServicesHref(locale: PublicLocale) {
  return `${getHomeHref(locale)}#hizmetler`;
}

export function getRoomsSectionHref(locale: PublicLocale) {
  return `${getHomeHref(locale)}#odalar`;
}

export function getLocalizedRoomSlug(originalSlug: string, locale: PublicLocale) {
  return roomSlugTranslations[locale][originalSlug] ?? originalSlug;
}

export function getOriginalRoomSlug(localizedSlug: string, locale: PublicLocale) {
  return localizedRoomSlugs[locale][localizedSlug] ?? (locale === defaultLocale ? localizedSlug : "");
}

export function getOriginalRoomSlugFromAnyLocale(slug: string) {
  for (const locale of publicLocales) {
    const originalSlug = localizedRoomSlugs[locale][slug];

    if (originalSlug) {
      return originalSlug;
    }
  }

  return roomSlugTranslations[defaultLocale][slug] ? slug : "";
}

export function getRoomHref(originalSlug: string, locale: PublicLocale) {
  return `${getRouteHref(locale, "rooms")}/${getLocalizedRoomSlug(originalSlug, locale)}`;
}

function stripLocalePrefix(pathname: string, locale: PublicLocale) {
  if (locale === defaultLocale) return pathname || "/";

  const stripped = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), "");
  return stripped || "/";
}

function findRouteBySegment(segment: string | undefined, locale: PublicLocale): Exclude<RouteKey, "home"> | null {
  if (!segment) return null;

  const entry = Object.entries(routeSegments[locale]).find(([, localizedSegment]) => localizedSegment === segment);
  return (entry?.[0] as Exclude<RouteKey, "home"> | undefined) ?? null;
}

export function getLanguageSwitchHref(pathname: string, targetLocale: PublicLocale) {
  const [rawPathname, rawQuery = ""] = pathname.split("?");
  const cleanPathname = rawPathname.split("#")[0] || "/";
  const currentLocale = getLocaleFromPathname(cleanPathname);
  const pathWithoutLocale = stripLocalePrefix(cleanPathname, currentLocale);

  if (pathWithoutLocale === "/") {
    return getHomeHref(targetLocale);
  }

  const [segment, slug] = pathWithoutLocale.split("/").filter(Boolean);
  const route = findRouteBySegment(segment, currentLocale);

  if (!route) {
    return getHomeHref(targetLocale);
  }

  if (route === "rooms" && slug) {
    const originalSlug = getOriginalRoomSlug(slug, currentLocale);
    return originalSlug ? getRoomHref(originalSlug, targetLocale) : getRouteHref(targetLocale, "rooms");
  }

  const href = getRouteHref(targetLocale, route);

  if (route === "booking" && rawQuery) {
    const query = new URLSearchParams(rawQuery);
    const roomQuery = query.get("room") ?? query.get("roomSlug");

    if (roomQuery) {
      const originalRoomSlug = getOriginalRoomSlug(roomQuery, currentLocale) || getOriginalRoomSlugFromAnyLocale(roomQuery);

      if (originalRoomSlug) {
        query.set("room", getLocalizedRoomSlug(originalRoomSlug, targetLocale));
        query.delete("roomSlug");
      }
    }

    const queryString = query.toString();
    return queryString ? `${href}?${queryString}` : href;
  }

  return href;
}

export const publicCopy = {
  tr: {
    nav: {
      home: "Ana sayfa",
      mainMenu: "Ana menü",
      mobileMenu: "Mobil menü",
      openMenu: "Menüyü aç",
      closeMenu: "Menüyü kapat",
      rooms: "ODALAR",
      services: "HİZMETLER",
      history: "TARİHÇE",
      gallery: "GALERİ",
      contact: "İLETİŞİM",
      booking: "REZERVASYON YAP"
    },
    home: {
      exploreRooms: "ODALARI KEŞFET",
      roomsTitle: "Odalar ve Suitler",
      historyImageAlt: "Tarihi doku",
      storyLink: "Hikayeyi Oku"
    },
    footer: {
      title: "Ordu'nun merkezinde, tarihi bir yapının içinde sakin bir durak.",
      locationKicker: "Konum",
      locationTitle: "Google Maps üzerinde kolay ulaşım.",
      mapAria: "Google Maps konumu",
      openMap: "Haritada Aç"
    },
    bookingForm: {
      ariaLabel: "Rezervasyon",
      checkIn: "Giriş",
      checkOut: "Çıkış",
      room: "Oda",
      adults: "Yetişkin",
      children: "Çocuk",
      name: "Ad Soyad",
      phone: "Telefon",
      email: "E-posta",
      note: "Not",
      website: "Web sitesi",
      capacityExceeded: "Kapasite aşıldı",
      checkingAvailability: "Müsaitlik kontrol ediliyor",
      availabilityFailed: "Müsaitlik alınamadı",
      unavailable: "Müsait oda yok",
      unavailableSelected: "Seçilen tarih aralığında bu oda için müsaitlik yok.",
      noAvailabilitySuggestion: "Farklı tarih veya oda seçin",
      nights: "gece",
      roomsAvailable: "oda müsait",
      perNight: "gece",
      guests: "misafir",
      submit: "Rezervasyonu Tamamla",
      submitting: "Gönderiliyor",
      chooseDate: "Uygun Tarih Seçin",
      paymentRedirect: "Rezervasyon talebiniz alındı. Güvenli ödeme ekranına yönlendiriliyorsunuz.",
      paymentStartFailed:
        "Rezervasyon talebiniz alındı ancak ödeme başlatılamadı. Otel kısa süre içinde sizinle iletişime geçecek.",
      requestWithTotal:
        "Talebiniz alındı. Talep no {id} · Tahmini toplam {total}. Otel kısa süre içinde sizinle iletişime geçecek.",
      requestWithoutTotal: "Talebiniz alındı. Otel kısa süre içinde sizinle iletişime geçecek.",
      confirmedWithTotal:
        "Rezervasyonunuz oluşturuldu. Rezervasyon no {id} · Tahmini toplam {total}. Otel gerekli durumda sizinle iletişime geçebilir.",
      confirmedWithoutTotal: "Rezervasyonunuz oluşturuldu. Otel gerekli durumda sizinle iletişime geçebilir.",
      requestFailed: "Talep gönderilemedi.",
      connectionError: "Bağlantı kurulamadı. Lütfen telefon veya WhatsApp üzerinden bize ulaşın.",
      occupancyError: "{room} için en fazla {capacity} misafir seçilebilir."
    },
    bookingPage: {
      kicker: "Doğrudan rezervasyon",
      title: "Müsait tarihleri seçin, odanızı güvenle ayırın.",
      body:
        "Tarih, oda ve misafir bilgilerini seçtiğinizde sistem müsaitliği ve toplam tutarı anlık hesaplar. Rezervasyonunuz otelin paneline doğrudan düşer."
    },
    rooms: {
      statsAria: "Oda sayıları",
      totalRooms: "Oda",
      suiteRooms: "Suit Oda",
      familyRooms: "Aile Odası",
      standardRooms: "Standart Oda",
      featureAria: "Oda içi önemli detaylar",
      inspect: "İncele"
    },
    roomDetail: {
      back: "Odalara dön",
      booking: "Rezervasyon Yap",
      metricsAria: "{room} oda bilgileri",
      area: "Alan",
      capacity: "Kapasite",
      bed: "Yatak",
      photosTitle: "{room} fotoğrafları",
      photoAlt: "{room} fotoğrafı {index}",
      experience: "Oda deneyimi",
      featureTitle: "Odada öne çıkan detaylar",
      amenitiesTitle: "Oda imkanları",
      directBooking: "Doğrudan rezervasyon",
      otherRooms: "Diğer oda seçenekleri"
    },
    gallery: {
      aria: "Galeri",
      stripAria: "Otelden fotoğraflar",
      enlarge: "{title} görselini büyüt",
      close: "Galeriyi kapat",
      previous: "Önceki görsel",
      next: "Sonraki görsel"
    },
    contact: {
      whatsapp: "WhatsApp",
      mapAria: "Şükrü Efendi Ottoman Hotel konumu",
      mapTitle: "Şükrü Efendi Ottoman Hotel Google Maps konumu"
    },
    floating: {
      aria: "Hızlı iletişim",
      whatsapp: "WhatsApp ile iletişime geç",
      phone: "Telefonla ara"
    },
    metadata: {
      homeTitle: "Ordu Merkezde Tarihi Otel",
      homeTwitterTitle: "Şükrü Efendi Ottoman Hotel | Ordu Merkez",
      roomsTitle: "Odalar",
      roomsDescription: "Şükrü Efendi Ottoman Hotel standart, suit ve aile odaları.",
      roomsOgDescription: "Ordu merkezde standart, suit ve aile odası seçenekleri.",
      galleryTitle: "Galeri",
      galleryDescription: "Şükrü Efendi Ottoman Hotel dış cephe, resepsiyon, oda ve detay fotoğrafları.",
      contactTitle: "İletişim",
      contactDescription: "Şükrü Efendi Ottoman Hotel telefon, WhatsApp, e-posta ve konum bilgileri.",
      contactOgDescription: "Rezervasyon, telefon, WhatsApp, e-posta ve Ordu merkez konum bilgileri.",
      bookingTitle: "Rezervasyon",
      bookingDescription: "Şükrü Efendi Ottoman Hotel için oda müsaitliği, tarih seçimi ve doğrudan rezervasyon.",
      bookingOgDescription: "Ordu merkezde konaklama için müsait tarihleri kontrol edip doğrudan rezervasyon yapın.",
      historyTitle: "Tarihçe",
      historyDescription: "Şükrü Efendi Ottoman Hotel tarihi yapısı ve korunmuş atmosferi."
    }
  },
  en: {
    nav: {
      home: "Home",
      mainMenu: "Main menu",
      mobileMenu: "Mobile menu",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      rooms: "ROOMS",
      services: "SERVICES",
      history: "HISTORY",
      gallery: "GALLERY",
      contact: "CONTACT",
      booking: "BOOK NOW"
    },
    home: {
      exploreRooms: "EXPLORE ROOMS",
      roomsTitle: "Rooms & Suites",
      historyImageAlt: "Historic texture",
      storyLink: "Read the Story"
    },
    footer: {
      title: "A calm stop inside a historic building in the center of Ordu.",
      locationKicker: "Location",
      locationTitle: "Easy access on Google Maps.",
      mapAria: "Google Maps location",
      openMap: "Open in Maps"
    },
    bookingForm: {
      ariaLabel: "Reservation",
      checkIn: "Check-in",
      checkOut: "Check-out",
      room: "Room",
      adults: "Adults",
      children: "Children",
      name: "Full Name",
      phone: "Phone",
      email: "Email",
      note: "Note",
      website: "Website",
      capacityExceeded: "Capacity exceeded",
      checkingAvailability: "Checking availability",
      availabilityFailed: "Availability could not be loaded",
      unavailable: "No rooms available",
      unavailableSelected: "This room is not available for the selected dates.",
      noAvailabilitySuggestion: "Choose different dates or another room",
      nights: "nights",
      roomsAvailable: "rooms available",
      perNight: "night",
      guests: "guests",
      submit: "Complete Booking",
      submitting: "Sending",
      chooseDate: "Choose Available Dates",
      paymentRedirect: "Your reservation request has been received. Redirecting you to secure payment.",
      paymentStartFailed:
        "Your reservation request was received, but payment could not be started. The hotel will contact you shortly.",
      requestWithTotal:
        "Your request has been received. Request no {id} · Estimated total {total}. The hotel will contact you shortly.",
      requestWithoutTotal: "Your request has been received. The hotel will contact you shortly.",
      confirmedWithTotal:
        "Your booking has been created. Booking no {id} · Estimated total {total}. The hotel may contact you if needed.",
      confirmedWithoutTotal: "Your booking has been created. The hotel may contact you if needed.",
      requestFailed: "The request could not be sent.",
      connectionError: "Could not connect. Please contact us by phone or WhatsApp.",
      occupancyError: "{room} allows up to {capacity} guests."
    },
    bookingPage: {
      kicker: "Direct booking",
      title: "Choose your dates and reserve your room securely.",
      body:
        "Select dates, room and guests to check live availability and estimated total. Your booking is sent directly to the hotel panel."
    },
    rooms: {
      statsAria: "Room counts",
      totalRooms: "Rooms",
      suiteRooms: "Suite Rooms",
      familyRooms: "Family Rooms",
      standardRooms: "Standard Rooms",
      featureAria: "Key in-room details",
      inspect: "View"
    },
    roomDetail: {
      back: "Back to rooms",
      booking: "Book Now",
      metricsAria: "{room} room details",
      area: "Area",
      capacity: "Capacity",
      bed: "Bed",
      photosTitle: "{room} photos",
      photoAlt: "{room} photo {index}",
      experience: "Room experience",
      featureTitle: "Featured room details",
      amenitiesTitle: "Room amenities",
      directBooking: "Direct booking",
      otherRooms: "Other room options"
    },
    gallery: {
      aria: "Gallery",
      stripAria: "Photos from the hotel",
      enlarge: "Enlarge {title} image",
      close: "Close gallery",
      previous: "Previous image",
      next: "Next image"
    },
    contact: {
      whatsapp: "WhatsApp",
      mapAria: "Şükrü Efendi Ottoman Hotel location",
      mapTitle: "Şükrü Efendi Ottoman Hotel Google Maps location"
    },
    floating: {
      aria: "Quick contact",
      whatsapp: "Contact us on WhatsApp",
      phone: "Call by phone"
    },
    metadata: {
      homeTitle: "Historic Hotel in Ordu City Center",
      homeTwitterTitle: "Şükrü Efendi Ottoman Hotel | Ordu City Center",
      roomsTitle: "Rooms",
      roomsDescription: "Standard, suite and family rooms at Şükrü Efendi Ottoman Hotel.",
      roomsOgDescription: "Standard, suite and family room options in the center of Ordu.",
      galleryTitle: "Gallery",
      galleryDescription: "Exterior, reception, room and detail photos from Şükrü Efendi Ottoman Hotel.",
      contactTitle: "Contact",
      contactDescription: "Phone, WhatsApp, email and location details for Şükrü Efendi Ottoman Hotel.",
      contactOgDescription: "Reservation, phone, WhatsApp, email and central Ordu location details.",
      bookingTitle: "Booking",
      bookingDescription: "Room availability, date selection and direct booking for Şükrü Efendi Ottoman Hotel.",
      bookingOgDescription: "Check available dates and book directly for your stay in central Ordu.",
      historyTitle: "History",
      historyDescription: "The historic building and preserved atmosphere of Şükrü Efendi Ottoman Hotel."
    }
  },
  de: {
    nav: {
      home: "Startseite",
      mainMenu: "Hauptmenü",
      mobileMenu: "Mobiles Menü",
      openMenu: "Menü öffnen",
      closeMenu: "Menü schließen",
      rooms: "ZIMMER",
      services: "SERVICE",
      history: "GESCHICHTE",
      gallery: "GALERIE",
      contact: "KONTAKT",
      booking: "RESERVIEREN"
    },
    home: {
      exploreRooms: "ZIMMER ENTDECKEN",
      roomsTitle: "Zimmer & Suiten",
      historyImageAlt: "Historische Atmosphäre",
      storyLink: "Geschichte lesen"
    },
    footer: {
      title: "Ein ruhiger Ort in einem historischen Gebäude im Zentrum von Ordu.",
      locationKicker: "Lage",
      locationTitle: "Einfach erreichbar über Google Maps.",
      mapAria: "Google-Maps-Standort",
      openMap: "In Maps öffnen"
    },
    bookingForm: {
      ariaLabel: "Reservierung",
      checkIn: "Anreise",
      checkOut: "Abreise",
      room: "Zimmer",
      adults: "Erwachsene",
      children: "Kinder",
      name: "Vor- und Nachname",
      phone: "Telefon",
      email: "E-Mail",
      note: "Notiz",
      website: "Webseite",
      capacityExceeded: "Kapazität überschritten",
      checkingAvailability: "Verfügbarkeit wird geprüft",
      availabilityFailed: "Verfügbarkeit konnte nicht geladen werden",
      unavailable: "Keine Zimmer verfügbar",
      unavailableSelected: "Dieses Zimmer ist für die gewählten Daten nicht verfügbar.",
      noAvailabilitySuggestion: "Wählen Sie andere Daten oder ein anderes Zimmer",
      nights: "Nächte",
      roomsAvailable: "Zimmer verfügbar",
      perNight: "Nacht",
      guests: "Gäste",
      submit: "Reservierung abschließen",
      submitting: "Wird gesendet",
      chooseDate: "Verfügbare Daten wählen",
      paymentRedirect: "Ihre Reservierungsanfrage wurde empfangen. Sie werden zur sicheren Zahlung weitergeleitet.",
      paymentStartFailed:
        "Ihre Reservierungsanfrage wurde empfangen, aber die Zahlung konnte nicht gestartet werden. Das Hotel meldet sich in Kürze.",
      requestWithTotal:
        "Ihre Anfrage wurde empfangen. Anfrage Nr. {id} · Geschätztsumme {total}. Das Hotel meldet sich in Kürze.",
      requestWithoutTotal: "Ihre Anfrage wurde empfangen. Das Hotel meldet sich in Kürze.",
      confirmedWithTotal:
        "Ihre Reservierung wurde erstellt. Reservierungsnr. {id} · Geschätzte Summe {total}. Das Hotel kontaktiert Sie bei Bedarf.",
      confirmedWithoutTotal: "Ihre Reservierung wurde erstellt. Das Hotel kontaktiert Sie bei Bedarf.",
      requestFailed: "Die Anfrage konnte nicht gesendet werden.",
      connectionError: "Keine Verbindung möglich. Bitte kontaktieren Sie uns per Telefon oder WhatsApp.",
      occupancyError: "{room} erlaubt bis zu {capacity} Gäste."
    },
    bookingPage: {
      kicker: "Direkte Reservierung",
      title: "Wählen Sie Ihre Daten und reservieren Sie Ihr Zimmer sicher.",
      body:
        "Wählen Sie Daten, Zimmer und Gäste aus, um Verfügbarkeit und geschätzte Summe direkt zu prüfen. Ihre Reservierung wird an das Hotelpanel gesendet."
    },
    rooms: {
      statsAria: "Zimmeranzahl",
      totalRooms: "Zimmer",
      suiteRooms: "Suiten",
      familyRooms: "Familienzimmer",
      standardRooms: "Standardzimmer",
      featureAria: "Wichtige Zimmerdetails",
      inspect: "Ansehen"
    },
    roomDetail: {
      back: "Zurück zu den Zimmern",
      booking: "Reservieren",
      metricsAria: "{room} Zimmerdetails",
      area: "Fläche",
      capacity: "Kapazität",
      bed: "Bett",
      photosTitle: "{room} Fotos",
      photoAlt: "{room} Foto {index}",
      experience: "Zimmererlebnis",
      featureTitle: "Besondere Zimmerdetails",
      amenitiesTitle: "Zimmerausstattung",
      directBooking: "Direkte Reservierung",
      otherRooms: "Weitere Zimmeroptionen"
    },
    gallery: {
      aria: "Galerie",
      stripAria: "Fotos aus dem Hotel",
      enlarge: "Bild {title} vergrößern",
      close: "Galerie schließen",
      previous: "Vorheriges Bild",
      next: "Nächstes Bild"
    },
    contact: {
      whatsapp: "WhatsApp",
      mapAria: "Standort des Şükrü Efendi Ottoman Hotel",
      mapTitle: "Şükrü Efendi Ottoman Hotel Standort auf Google Maps"
    },
    floating: {
      aria: "Schnellkontakt",
      whatsapp: "Per WhatsApp kontaktieren",
      phone: "Telefonisch anrufen"
    },
    metadata: {
      homeTitle: "Historisches Hotel im Zentrum von Ordu",
      homeTwitterTitle: "Şükrü Efendi Ottoman Hotel | Zentrum von Ordu",
      roomsTitle: "Zimmer",
      roomsDescription: "Standardzimmer, Suiten und Familienzimmer im Şükrü Efendi Ottoman Hotel.",
      roomsOgDescription: "Standard-, Suite- und Familienzimmer im Zentrum von Ordu.",
      galleryTitle: "Galerie",
      galleryDescription: "Außenansicht, Rezeption, Zimmer und Detailfotos des Şükrü Efendi Ottoman Hotel.",
      contactTitle: "Kontakt",
      contactDescription: "Telefon, WhatsApp, E-Mail und Standort des Şükrü Efendi Ottoman Hotel.",
      contactOgDescription: "Reservierung, Telefon, WhatsApp, E-Mail und Lage im Zentrum von Ordu.",
      bookingTitle: "Reservierung",
      bookingDescription: "Zimmerverfügbarkeit, Datumsauswahl und direkte Reservierung für das Şükrü Efendi Ottoman Hotel.",
      bookingOgDescription: "Prüfen Sie verfügbare Daten und buchen Sie direkt für Ihren Aufenthalt im Zentrum von Ordu.",
      historyTitle: "Geschichte",
      historyDescription: "Das historische Gebäude und die bewahrte Atmosphäre des Şükrü Efendi Ottoman Hotel."
    }
  }
} satisfies Record<PublicLocale, PublicCopy>;

type PublicCopy = {
  nav: Record<
    | "home"
    | "mainMenu"
    | "mobileMenu"
    | "openMenu"
    | "closeMenu"
    | "rooms"
    | "services"
    | "history"
    | "gallery"
    | "contact"
    | "booking",
    string
  >;
  home: Record<"exploreRooms" | "roomsTitle" | "historyImageAlt" | "storyLink", string>;
  footer: Record<"title" | "locationKicker" | "locationTitle" | "mapAria" | "openMap", string>;
  bookingForm: Record<
    | "ariaLabel"
    | "checkIn"
    | "checkOut"
    | "room"
    | "adults"
    | "children"
    | "name"
    | "phone"
    | "email"
    | "note"
    | "website"
    | "capacityExceeded"
    | "checkingAvailability"
    | "availabilityFailed"
    | "unavailable"
    | "unavailableSelected"
    | "noAvailabilitySuggestion"
    | "nights"
    | "roomsAvailable"
    | "perNight"
    | "guests"
    | "submit"
    | "submitting"
    | "chooseDate"
    | "paymentRedirect"
    | "paymentStartFailed"
    | "requestWithTotal"
    | "requestWithoutTotal"
    | "confirmedWithTotal"
    | "confirmedWithoutTotal"
    | "requestFailed"
    | "connectionError"
    | "occupancyError",
    string
  >;
  bookingPage: Record<"kicker" | "title" | "body", string>;
  rooms: Record<
    | "statsAria"
    | "totalRooms"
    | "suiteRooms"
    | "familyRooms"
    | "standardRooms"
    | "featureAria"
    | "inspect",
    string
  >;
  roomDetail: Record<
    | "back"
    | "booking"
    | "metricsAria"
    | "area"
    | "capacity"
    | "bed"
    | "photosTitle"
    | "photoAlt"
    | "experience"
    | "featureTitle"
    | "amenitiesTitle"
    | "directBooking"
    | "otherRooms",
    string
  >;
  gallery: Record<"aria" | "stripAria" | "enlarge" | "close" | "previous" | "next", string>;
  contact: Record<"whatsapp" | "mapAria" | "mapTitle", string>;
  floating: Record<"aria" | "whatsapp" | "phone", string>;
  metadata: Record<
    | "homeTitle"
    | "homeTwitterTitle"
    | "roomsTitle"
    | "roomsDescription"
    | "roomsOgDescription"
    | "galleryTitle"
    | "galleryDescription"
    | "contactTitle"
    | "contactDescription"
    | "contactOgDescription"
    | "bookingTitle"
    | "bookingDescription"
    | "bookingOgDescription"
    | "historyTitle"
    | "historyDescription",
    string
  >;
};

type LocalizedContentPatch = {
  siteDescription: string;
  services: string[];
  roomFeatures: Record<RoomFeature["icon"], Pick<RoomFeature, "title" | "description">>;
  rooms: Record<
    string,
    Pick<Room, "title" | "description" | "longDescription" | "capacity" | "bed" | "amenities">
  >;
  galleryItems: Record<string, string>;
  pages: Pick<SiteContent, "pages">["pages"];
};

const localizedContentPatches: Record<Exclude<PublicLocale, "tr">, LocalizedContentPatch> = {
  en: {
    siteDescription:
      "A boutique hotel in the center of Ordu, blending the calm of a historic building with a stay close to city life.",
    services: [
      "Central location in Ordu",
      "24-hour reception",
      "Free Wi-Fi",
      "Daily housekeeping",
      "Luggage storage",
      "Courtyard and lobby areas",
      "Private welcome service",
      "Transfer assistance"
    ],
    roomFeatures: {
      "smart-entry": {
        title: "Smart Entry",
        description: "Room access and arrival are practical, secure and supported by reception when needed."
      },
      safe: {
        title: "In-room Safe",
        description: "A safe is available in the room so you can keep personal belongings secure during your stay."
      },
      wifi: {
        title: "Free Wi-Fi",
        description: "Complimentary internet access is available in guest rooms and shared areas."
      }
    },
    rooms: {
      "standart-oda": {
        title: "Standard Room",
        description:
          "A simple, comfortable and well-considered room for short stays and business trips in the city center.",
        longDescription:
          "Standard rooms are prepared for guests who spend the day in the city and return to a calm room in the evening. Clean lines, practical use and modern comfort are kept together.",
        capacity: "Up to 3 guests",
        bed: "Single or double bed",
        amenities: ["Smart entry", "In-room safe", "Free Wi-Fi", "Minibar", "Air conditioning", "Hair dryer"]
      },
      "suit-oda": {
        title: "Suite Room",
        description:
          "A more spacious room, balanced for longer stays or a special city escape.",
        longDescription:
          "Suite rooms offer a wider living area with a calm atmosphere that suits the hotel's historic texture. With a sitting corner, jacuzzi area and in-room comfort details, the stay becomes time to truly rest.",
        capacity: "Up to 3 guests",
        bed: "Large bed and sitting area",
        amenities: ["Smart entry", "In-room safe", "Free Wi-Fi", "Jacuzzi area", "Sitting corner", "Minibar"]
      },
      "aile-odalari": {
        title: "Family Rooms",
        description:
          "A practical, calm and central space for families and guests travelling together.",
        longDescription:
          "Family rooms are designed around the comfort of guests sharing the same city program. They offer a stay close to daily needs, within walking distance of the center and with easy access to hotel services.",
        capacity: "Up to 4 guests",
        bed: "Family-friendly layout",
        amenities: [
          "Smart entry",
          "In-room safe",
          "Free Wi-Fi",
          "Family-friendly layout",
          "Air conditioning",
          "Daily housekeeping"
        ]
      }
    },
    galleryItems: {
      "/hotel-images/hero-facade-night.webp": "Exterior facade",
      "/hotel-images/gallery-room-suite-wide.webp": "Wide room view",
      "/hotel-images/gallery-window-curtain.webp": "Stone wall and curtain",
      "/hotel-images/gallery-reception-desk.webp": "Reception",
      "/hotel-images/gallery-city-center.webp": "Facade in the city center",
      "/hotel-images/gallery-room-card.webp": "Room key card",
      "/hotel-images/gallery-facade-night-new.webp": "Night facade",
      "/hotel-images/gallery-safe-close.webp": "In-room safe",
      "/hotel-images/gallery-facade-corner-day.webp": "Corner facade",
      "/hotel-images/gallery-lamps-painting.webp": "Lighting detail",
      "/hotel-images/gallery-room-upper-view.webp": "Upper room view",
      "/hotel-images/gallery-room-wide.webp": "Room layout",
      "/hotel-images/gallery-amenities.webp": "Room amenities",
      "/hotel-images/bathroom.webp": "Bathroom",
      "/hotel-images/key-welcome.webp": "Welcome",
      "/hotel-images/gallery-google-review.webp": "Google review"
    },
    pages: {
      home: {
        heroTitle: "IN THE HEART OF THE CITY",
        heroEmphasis: "REFINED STAY",
        heroLead: "A calm and thoughtful hotel experience in a 400-year-old historic building at the center of the city.",
        heroImage: "/hotel-images/hero-facade-night.webp",
        historyTitle: "Not the feel of a new building, but the sense of preserved time.",
        historyText:
          "The character of Şükrü Efendi Ottoman Hotel comes from the calm presence of its historic building. The stay takes place close to the city center, yet in a peaceful space of its own.",
        historyImage: "/hotel-images/facade-night-wide.webp"
      },
      rooms: {
        title: "Rooms selected around every stay in the city center.",
        body: "Each room was prepared with a simple sense of comfort. Different uses are considered for short stays, business trips and family visits."
      },
      gallery: {
        title: "Frames that carry the character of the hotel.",
        body: "Selected photos showing the hotel's atmosphere, from the exterior and reception to room details and shared areas."
      },
      contact: {
        title: "Contact the hotel directly for reservations and information.",
        body: "Share your dates, number of guests and room preference to quickly learn suitable options.",
        contactTitle: "Direct contact",
        locationTitle: "Ordu city center"
      },
      history: {
        title: "Not the feel of a new building, but the sense of preserved time.",
        body: "The hotel's character comes from the measured, calm presence of its historic building. The aim is not to show the past as decoration, but to make it a natural part of the stay.",
        image: "/hotel-images/facade-night-wide.webp",
        timeline: [
          "The memory of the building is preserved; every new detail is considered with that measure.",
          "Its location in the city creates a stay where many points are reachable on foot.",
          "Modern comfort is carried into the rooms and shared areas without disturbing the rhythm of the historic building."
        ]
      }
    }
  },
  de: {
    siteDescription:
      "Ein Boutique-Hotel im Zentrum von Ordu, das die Ruhe eines historischen Gebäudes mit citynaher Unterkunft verbindet.",
    services: [
      "Zentrale Lage in Ordu",
      "24-Stunden-Rezeption",
      "Kostenloses WLAN",
      "Tägliche Reinigung",
      "Gepäckaufbewahrung",
      "Innenhof und Lobbybereiche",
      "Persönlicher Empfangsservice",
      "Transferunterstützung"
    ],
    roomFeatures: {
      "smart-entry": {
        title: "Smart Entry",
        description: "Zimmerzugang und Ankunft verlaufen praktisch, sicher und bei Bedarf mit Unterstützung der Rezeption."
      },
      safe: {
        title: "Zimmersafe",
        description: "Im Zimmer steht ein Safe zur Verfügung, damit persönliche Gegenstände sicher aufbewahrt werden können."
      },
      wifi: {
        title: "Kostenloses WLAN",
        description: "Kostenloser Internetzugang steht in den Zimmern und Gemeinschaftsbereichen bereit."
      }
    },
    rooms: {
      "standart-oda": {
        title: "Standardzimmer",
        description:
          "Ein schlichtes, komfortables und gut durchdachtes Zimmer für kurze Aufenthalte und Geschäftsreisen im Zentrum.",
        longDescription:
          "Standardzimmer sind für Gäste vorbereitet, die tagsüber in der Stadt unterwegs sind und abends in ein ruhiges Zimmer zurückkehren möchten. Klare Linien, praktische Nutzung und zeitgemäßer Komfort bleiben zusammen.",
        capacity: "Bis zu 3 Gäste",
        bed: "Einzel- oder Doppelbett",
        amenities: ["Smart Entry", "Zimmersafe", "Kostenloses WLAN", "Minibar", "Klimaanlage", "Haartrockner"]
      },
      "suit-oda": {
        title: "Suite-Zimmer",
        description:
          "Ein großzügigeres Zimmer, ausgewogen für längere Aufenthalte oder eine besondere Auszeit in der Stadt.",
        longDescription:
          "Suite-Zimmer bieten mehr Bewegungsfreiheit in einer ruhigen Atmosphäre, die zur historischen Struktur des Hotels passt. Sitzecke, Jacuzzi-Bereich und Komfortdetails verwandeln den Aufenthalt in echte Erholungszeit.",
        capacity: "Bis zu 3 Gäste",
        bed: "Großes Bett und Sitzecke",
        amenities: ["Smart Entry", "Zimmersafe", "Kostenloses WLAN", "Jacuzzi-Bereich", "Sitzecke", "Minibar"]
      },
      "aile-odalari": {
        title: "Familienzimmer",
        description:
          "Ein praktischer, ruhiger und zentraler Bereich für Familien und gemeinsam reisende Gäste.",
        longDescription:
          "Familienzimmer sind auf den Komfort von Gästen ausgerichtet, die dasselbe Stadtprogramm teilen. Sie bieten eine Unterkunft nahe an täglichen Bedürfnissen, fußläufig zum Zentrum und mit einfachem Zugang zu den Hotelleistungen.",
        capacity: "Bis zu 4 Gäste",
        bed: "Familienfreundliche Aufteilung",
        amenities: [
          "Smart Entry",
          "Zimmersafe",
          "Kostenloses WLAN",
          "Familienfreundliche Aufteilung",
          "Klimaanlage",
          "Tägliche Reinigung"
        ]
      }
    },
    galleryItems: {
      "/hotel-images/hero-facade-night.webp": "Außenfassade",
      "/hotel-images/gallery-room-suite-wide.webp": "Großzügige Zimmeransicht",
      "/hotel-images/gallery-window-curtain.webp": "Steinwand und Vorhang",
      "/hotel-images/gallery-reception-desk.webp": "Rezeption",
      "/hotel-images/gallery-city-center.webp": "Fassade im Stadtzentrum",
      "/hotel-images/gallery-room-card.webp": "Zimmerkarte",
      "/hotel-images/gallery-facade-night-new.webp": "Nachtfassade",
      "/hotel-images/gallery-safe-close.webp": "Zimmersafe",
      "/hotel-images/gallery-facade-corner-day.webp": "Eckfassade",
      "/hotel-images/gallery-lamps-painting.webp": "Lichtdetail",
      "/hotel-images/gallery-room-upper-view.webp": "Zimmeransicht von oben",
      "/hotel-images/gallery-room-wide.webp": "Zimmeraufteilung",
      "/hotel-images/gallery-amenities.webp": "Zimmerausstattung",
      "/hotel-images/bathroom.webp": "Bad",
      "/hotel-images/key-welcome.webp": "Willkommen",
      "/hotel-images/gallery-google-review.webp": "Google-Bewertung"
    },
    pages: {
      home: {
        heroTitle: "IM HERZEN DER STADT",
        heroEmphasis: "STILVOLL WOHNEN",
        heroLead:
          "Ein ruhiges und sorgfältig gestaltetes Hotelerlebnis in einem 400 Jahre alten historischen Gebäude im Zentrum der Stadt.",
        heroImage: "/hotel-images/hero-facade-night.webp",
        historyTitle: "Nicht das Gefühl eines Neubaus, sondern bewahrte Zeit.",
        historyText:
          "Der Charakter des Şükrü Efendi Ottoman Hotel entsteht aus der ruhigen Haltung des historischen Gebäudes. Der Aufenthalt liegt nah am Stadtzentrum und bleibt dennoch in einem eigenen, stillen Raum.",
        historyImage: "/hotel-images/facade-night-wide.webp"
      },
      rooms: {
        title: "Zimmer im Stadtzentrum, passend zu unterschiedlichen Aufenthalten.",
        body: "Jedes Zimmer wurde mit einem klaren Komfortverständnis vorbereitet. Kurze Aufenthalte, Geschäftsreisen und Familienbesuche wurden unterschiedlich mitgedacht."
      },
      gallery: {
        title: "Bilder, die den Charakter des Hotels zeigen.",
        body: "Ausgewählte Fotos zeigen die Atmosphäre des Hotels, von der Außenfassade und Rezeption bis zu Zimmerdetails und Gemeinschaftsbereichen."
      },
      contact: {
        title: "Kontaktieren Sie das Hotel direkt für Reservierung und Information.",
        body: "Teilen Sie Ihre Daten, Gästezahl und Zimmerwünsche mit, um passende Optionen schnell zu erfahren.",
        contactTitle: "Direkter Kontakt",
        locationTitle: "Stadtzentrum von Ordu"
      },
      history: {
        title: "Nicht das Gefühl eines Neubaus, sondern bewahrte Zeit.",
        body: "Der Charakter des Hotels entsteht aus der maßvollen und ruhigen Haltung des historischen Gebäudes. Ziel ist es nicht, die Vergangenheit als Dekoration zu zeigen, sondern sie zu einem natürlichen Teil des Aufenthalts zu machen.",
        image: "/hotel-images/facade-night-wide.webp",
        timeline: [
          "Die Erinnerung des Gebäudes wird bewahrt; jedes neue Detail folgt diesem Maß.",
          "Die Lage in der Stadt ermöglicht eine Unterkunft, bei der vieles zu Fuß erreichbar ist.",
          "Zeitgemäßer Komfort wird in Zimmer und Gemeinschaftsbereiche getragen, ohne den Rhythmus des historischen Gebäudes zu stören."
        ]
      }
    }
  }
};

export function getPublicCopy(locale: PublicLocale) {
  return publicCopy[locale];
}

export function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  );
}

export function localizeSiteContent(content: SiteContent, locale: PublicLocale): SiteContent {
  if (locale === defaultLocale) {
    return content;
  }

  const patch = localizedContentPatches[locale as Exclude<PublicLocale, "tr">];

  return {
    ...content,
    site: {
      ...content.site,
      description: patch.siteDescription
    },
    services: patch.services,
    roomFeatures: content.roomFeatures.map((feature) => ({
      ...feature,
      ...(patch.roomFeatures[feature.icon] ?? {})
    })),
    rooms: content.rooms.map((room) => ({
      ...room,
      ...(patch.rooms[room.slug] ?? {}),
      amenities: patch.rooms[room.slug]?.amenities ?? room.amenities
    })),
    galleryItems: content.galleryItems.map((item) => ({
      ...item,
      title: patch.galleryItems[item.image] ?? item.title
    })),
    pages: {
      home: {
        ...content.pages.home,
        ...patch.pages.home
      },
      rooms: {
        ...content.pages.rooms,
        ...patch.pages.rooms
      },
      gallery: {
        ...content.pages.gallery,
        ...patch.pages.gallery
      },
      contact: {
        ...content.pages.contact,
        ...patch.pages.contact
      },
      history: {
        ...content.pages.history,
        ...patch.pages.history
      }
    }
  };
}

export function localizeGalleryItems(items: GalleryItem[], locale: PublicLocale) {
  if (locale === defaultLocale) return items;

  const patch = localizedContentPatches[locale as Exclude<PublicLocale, "tr">];
  return items.map((item) => ({
    ...item,
    title: patch.galleryItems[item.image] ?? item.title
  }));
}

function absoluteUrl(baseUrl: string, path: string) {
  if (path === "/") return baseUrl;
  return `${baseUrl}${path}`;
}

function getLocalizedKeywords(locale: PublicLocale, siteName: string, extra: string[] = []) {
  const keywords = {
    tr: [
      siteName,
      "Ordu otel",
      "Altınordu otel",
      "Ordu merkez otel",
      "tarihi otel Ordu",
      "butik otel Ordu"
    ],
    en: [
      siteName,
      "hotel in Ordu",
      "Altinordu hotel",
      "Ordu city center hotel",
      "historic hotel in Ordu",
      "boutique hotel in Ordu"
    ],
    de: [
      siteName,
      "Hotel in Ordu",
      "Hotel Altinordu",
      "Hotel im Zentrum von Ordu",
      "historisches Hotel in Ordu",
      "Boutique-Hotel in Ordu"
    ]
  } satisfies Record<PublicLocale, string[]>;

  return [...keywords[locale], ...extra];
}

export function getAlternateLanguages(siteCanonicalUrl: string, route: RouteKey | "room", originalSlug?: string) {
  const languages = Object.fromEntries(
    publicLocales.map((locale) => {
      const href =
        route === "room"
          ? getRoomHref(originalSlug ?? "", locale)
          : getRouteHref(locale, route);

      return [locale, absoluteUrl(siteCanonicalUrl, href)];
    })
  );
  const defaultHref =
    route === "room"
      ? getRoomHref(originalSlug ?? "", defaultLocale)
      : getRouteHref(defaultLocale, route);

  return {
    ...languages,
    "x-default": absoluteUrl(siteCanonicalUrl, defaultHref)
  };
}

export function getOpenGraphLocale(locale: PublicLocale) {
  if (locale === "en") return "en_US";
  if (locale === "de") return "de_DE";
  return "tr_TR";
}

export function getPageMetadata(content: SiteContent, locale: PublicLocale, route: RouteKey): Metadata {
  const localizedContent = localizeSiteContent(content, locale);
  const { metadata } = getPublicCopy(locale);
  const { site } = localizedContent;
  const href = getRouteHref(locale, route);
  const url = absoluteUrl(site.canonicalUrl, href);

  const pageMetadata: Record<RouteKey, { title: string; description: string; image: string }> = {
    home: {
      title: metadata.homeTitle,
      description: site.description,
      image: "/og.webp"
    },
    rooms: {
      title: metadata.roomsTitle,
      description: metadata.roomsDescription,
      image: "/hotel-images/rooms/standard/standard-room-twin.webp"
    },
    gallery: {
      title: metadata.galleryTitle,
      description: metadata.galleryDescription,
      image: "/hotel-images/hero-facade-night.webp"
    },
    contact: {
      title: metadata.contactTitle,
      description: metadata.contactDescription,
      image: "/hotel-images/gallery-reception-desk.webp"
    },
    booking: {
      title: metadata.bookingTitle,
      description: metadata.bookingDescription,
      image: "/hotel-images/gallery-reception-desk.webp"
    },
    history: {
      title: metadata.historyTitle,
      description: metadata.historyDescription,
      image: "/hotel-images/facade-night-wide.webp"
    }
  };
  const item = pageMetadata[route];

  return {
    title: item.title,
    description: item.description,
    keywords: getLocalizedKeywords(
      locale,
      site.name,
      route === "rooms" ? [metadata.roomsTitle] : route === "booking" ? [metadata.bookingTitle] : []
    ),
    alternates: {
      canonical: href,
      languages: getAlternateLanguages(site.canonicalUrl, route)
    },
    openGraph: {
      locale: getOpenGraphLocale(locale),
      title: `${item.title} | ${site.name}`,
      description:
        route === "rooms"
          ? metadata.roomsOgDescription
          : route === "contact"
            ? metadata.contactOgDescription
            : route === "booking"
              ? metadata.bookingOgDescription
            : item.description,
      url,
      images: [item.image]
    },
    twitter:
      route === "home"
        ? {
            card: "summary_large_image",
            title: metadata.homeTwitterTitle,
            description: site.description,
            images: [item.image]
          }
        : undefined
  };
}

export function getRoomMetadata(content: SiteContent, locale: PublicLocale, originalSlug: string): Metadata {
  const localizedContent = localizeSiteContent(content, locale);
  const room = localizedContent.rooms.find((item) => item.slug === originalSlug);

  if (!room) return {};

  const href = getRoomHref(originalSlug, locale);
  const url = absoluteUrl(localizedContent.site.canonicalUrl, href);

  return {
    title: room.title,
    description: room.description,
    keywords: getLocalizedKeywords(locale, localizedContent.site.name, [room.title]),
    alternates: {
      canonical: href,
      languages: getAlternateLanguages(localizedContent.site.canonicalUrl, "room", originalSlug)
    },
    openGraph: {
      locale: getOpenGraphLocale(locale),
      title: `${room.title} | ${localizedContent.site.name}`,
      description: room.description,
      url,
      images: [room.image]
    }
  };
}
