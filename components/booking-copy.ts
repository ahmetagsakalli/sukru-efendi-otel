import type { PublicLocale } from "@/lib/i18n";

type BookingCopy = {
  heritage: string;
  heritageNote: string;
  title: string;
  introduction: string;
  stay: string;
  details: string;
  guestCountLabel: string;
  guestTitle: string;
  guestIntroduction: string;
  continue: string;
  total: string;
  available: string;
  selectDates: string;
  optional: string;
  notePlaceholder: string;
  notePrompt: string;
  edit: string;
  retry: string;
  successTitle: string;
  another: string;
};

export const bookingCopy: Record<PublicLocale, BookingCopy> = {
  tr: {
    heritage: "yıllık tarihi konağımız",
    heritageNote: "Ordu’nun kalbinde\nsizi bekliyoruz.",
    title: "Sizi ağırlamak isteriz.",
    introduction:
      "Konaklamak istediğiniz tarihleri ve size uygun odayı seçebilirsiniz.",
    stay: "Konaklama",
    details: "Misafir bilgileri",
    guestCountLabel: "Misafir sayınız",
    guestTitle: "Size nasıl ulaşabiliriz?",
    guestIntroduction:
      "Adınızı ve telefon numaranızı bizimle paylaşabilirsiniz.",
    continue: "Devam edin",
    total: "Konaklama tutarınız",
    available: "Seçtiğiniz tarihlerde sizi ağırlayabiliriz.",
    selectDates: "Lütfen giriş ve çıkış tarihlerinizi kontrol edin.",
    optional: "isteğe bağlı",
    notePrompt: "Bize iletmek istediğiniz bir şey var mı?",
    notePlaceholder: "Konaklamanızla ilgili bize iletmek istedikleriniz…",
    edit: "Seçimlerinizi değiştirin",
    retry: "Tekrar deneyin",
    successTitle: "Sizi bekliyoruz.",
    another: "Yeni bir rezervasyon yapın",
  },
  en: {
    heritage: "years of history",
    heritageNote: "We look forward\nto welcoming you.",
    title: "We would love to welcome you.",
    introduction:
      "Choose when you would like to stay and the room that suits you.",
    stay: "Your stay",
    details: "Guest details",
    guestCountLabel: "Your guests",
    guestTitle: "How can we reach you?",
    guestIntroduction: "Please share your name and phone number with us.",
    continue: "Continue",
    total: "Your stay total",
    available: "We have a room for you on these dates.",
    selectDates: "Please select valid check-in and check-out dates.",
    optional: "Optional",
    notePrompt: "Is there anything you would like us to know?",
    notePlaceholder: "Anything you would like us to know about your stay…",
    edit: "Edit",
    retry: "Try again",
    successTitle: "We look forward to your stay.",
    another: "Make another reservation",
  },
  de: {
    heritage: "Jahre Geschichte",
    heritageNote: "Wir freuen uns\nauf Ihren Besuch.",
    title: "Wir heißen Sie herzlich willkommen.",
    introduction:
      "Wählen Sie Ihre Reisedaten und das Zimmer, das zu Ihnen passt.",
    stay: "Aufenthalt",
    details: "Gästedaten",
    guestCountLabel: "Ihre Gäste",
    guestTitle: "Wie können wir Sie erreichen?",
    guestIntroduction:
      "Bitte teilen Sie uns Ihren Namen und Ihre Telefonnummer mit.",
    continue: "Weiter",
    total: "Ihr Gesamtpreis",
    available: "Zu Ihren Reisedaten haben wir ein Zimmer für Sie.",
    selectDates: "Bitte wählen Sie gültige An- und Abreisedaten.",
    optional: "Optional",
    notePrompt: "Möchten Sie uns noch etwas mitteilen?",
    notePlaceholder: "Was möchten Sie uns zu Ihrem Aufenthalt mitteilen?",
    edit: "Ändern",
    retry: "Erneut versuchen",
    successTitle: "Wir freuen uns auf Sie.",
    another: "Weitere Reservierung",
  },
};
