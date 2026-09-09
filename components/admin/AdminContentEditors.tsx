"use client";

import { useState } from "react";
import { bookingCopy } from "../booking-copy";
import { AdminText } from "./AdminControls";
import {
  localeLabels,
  localizeSiteContent,
  type PublicLocale,
} from "@/lib/i18n";
import type {
  BookingSettings,
  BookingText,
  SiteContent,
  SiteTranslation,
} from "@/lib/site-content-schema";

const bookingLimits: Record<keyof BookingText, number> = {
  title: 120,
  introduction: 500,
  heritage: 120,
  heritageNote: 260,
  guestTitle: 120,
  guestIntroduction: 500,
  continue: 80,
  notePrompt: 200,
  successTitle: 160,
};

const bookingFields: Array<[keyof BookingText, string, boolean]> = [
  ["title", "Karşılama başlığı", false],
  ["introduction", "Karşılama açıklaması", true],
  ["heritage", "Tarihi yapı açıklaması", false],
  ["heritageNote", "Yan bölümdeki metin", true],
  ["guestTitle", "İletişim adımının başlığı", false],
  ["guestIntroduction", "İletişim adımının açıklaması", true],
  ["continue", "Devam düğmesi", false],
  ["notePrompt", "Konaklama notu başlığı", false],
  ["successTitle", "Rezervasyon sonrası başlık", false],
];

export function AdminBookingEditor({
  value,
  onChange,
}: {
  value: BookingSettings;
  onChange: (value: BookingSettings) => void;
}) {
  const [locale, setLocale] = useState<PublicLocale>("tr");
  const copy = { ...bookingCopy[locale], ...value.copy[locale] };
  return (
    <div className="admin-section-stack" data-testid="admin-section-booking">
      <section className="admin-panel-section">
        <div className="admin-section-heading">
          <div>
            <h2>Rezervasyon alanı</h2>
            <span>
              Ana sayfada ve rezervasyon sayfasında görünen metinleri
              düzenleyin.
            </span>
          </div>
        </div>
        <div
          className="admin-language-tabs"
          aria-label="Rezervasyon metinlerinin dili"
        >
          {(["tr", "en", "de"] as const).map((language) => (
            <button
              type="button"
              key={language}
              aria-pressed={locale === language}
              onClick={() => setLocale(language)}
            >
              {localeLabels[language].native}
            </button>
          ))}
        </div>
        <div className="admin-form-grid">
          {bookingFields.map(([field, label, multiline]) => (
            <AdminText
              key={field}
              label={label}
              maxLength={bookingLimits[field]}
              multiline={multiline}
              value={copy[field]}
              onChange={(text) =>
                onChange({
                  ...value,
                  copy: {
                    ...value.copy,
                    [locale]: { ...value.copy[locale], [field]: text },
                  },
                })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export function AdminTranslationEditor({
  content,
  onChange,
}: {
  content: SiteContent;
  onChange: (locale: "en" | "de", value: SiteTranslation) => void;
}) {
  const [locale, setLocale] = useState<"en" | "de">("en");
  const translated = localizeSiteContent(content, locale);
  const saved = content.translations[locale] ?? {};
  function update(patch: Partial<SiteTranslation>) {
    onChange(locale, { ...saved, ...patch });
  }
  function pageField(
    page: keyof SiteContent["pages"],
    field: string,
    text: string | string[],
  ) {
    update({
      pages: {
        ...saved.pages,
        [page]: { ...saved.pages?.[page], [field]: text },
      },
    });
  }
  function roomField(
    index: number,
    field: "title" | "description" | "longDescription" | "bed" | "amenities",
    text: string | string[],
  ) {
    const rooms = translated.rooms.map(
      ({ slug, title, description, longDescription, bed, amenities }) => ({
        slug,
        title,
        description,
        longDescription,
        bed,
        amenities,
      }),
    );
    update({
      rooms: rooms.map((room, current) =>
        current === index ? { ...room, [field]: text } : room,
      ),
    });
  }
  return (
    <div
      className="admin-section-stack"
      data-testid="admin-section-translations"
    >
      <section className="admin-panel-section">
        <div className="admin-section-heading">
          <div>
            <h2>Dil içerikleri</h2>
            <span>
              Türkçe metinleri ilgili site bölümlerinden düzenleyebilirsiniz.
              Fotoğraflar, fiyatlar ve oda kapasitesi tüm dillerde ortaktır.
            </span>
          </div>
        </div>
        <div className="admin-language-tabs" aria-label="Site içeriğinin dili">
          {(["en", "de"] as const).map((language) => (
            <button
              key={language}
              type="button"
              aria-pressed={locale === language}
              onClick={() => setLocale(language)}
            >
              {localeLabels[language].native}
            </button>
          ))}
        </div>
        <AdminText
          label="Site açıklaması"
          multiline
          value={translated.site.description}
          onChange={(siteDescription) => update({ siteDescription })}
        />
      </section>
      <section className="admin-panel-section">
        <div className="admin-section-heading">
          <h2>Ana sayfa</h2>
        </div>
        <div className="admin-form-grid">
          {(
            [
              ["heroTitle", "Ana başlık"],
              ["heroEmphasis", "Vurgu başlığı"],
              ["heroLead", "Giriş metni"],
              ["historyTitle", "Tarihçe bölümünün başlığı"],
              ["historyText", "Tarihçe bölümünün metni"],
            ] as const
          ).map(([field, label]) => (
            <AdminText
              key={field}
              label={label}
              value={translated.pages.home[field]}
              multiline={field === "heroLead" || field === "historyText"}
              onChange={(text) => pageField("home", field, text)}
            />
          ))}
        </div>
      </section>
      {(
        [
          ["rooms", "Odalar sayfası"],
          ["gallery", "Galeri sayfası"],
          ["contact", "İletişim sayfası"],
          ["history", "Tarihçe sayfası"],
        ] as const
      ).map(([page, label]) => (
        <section className="admin-panel-section" key={page}>
          <div className="admin-section-heading">
            <h2>{label}</h2>
          </div>
          <div className="admin-form-grid">
            <AdminText
              label={`${label} başlığı`}
              value={translated.pages[page].title}
              onChange={(text) => pageField(page, "title", text)}
            />
            <AdminText
              label={`${label} açıklaması`}
              multiline
              value={translated.pages[page].body}
              onChange={(text) => pageField(page, "body", text)}
            />
            {page === "contact" && (
              <>
                <AdminText
                  label="İletişim bölümünün başlığı"
                  value={translated.pages.contact.contactTitle}
                  onChange={(text) =>
                    pageField("contact", "contactTitle", text)
                  }
                />
                <AdminText
                  label="Konum başlığı"
                  value={translated.pages.contact.locationTitle}
                  onChange={(text) =>
                    pageField("contact", "locationTitle", text)
                  }
                />
              </>
            )}
            {page === "history" &&
              translated.pages.history.timeline.map((line, index) => (
                <AdminText
                  key={index}
                  label={`Tarihçe satırı ${index + 1}`}
                  value={line}
                  onChange={(text) =>
                    pageField(
                      "history",
                      "timeline",
                      translated.pages.history.timeline.map((item, current) =>
                        current === index ? text : item,
                      ),
                    )
                  }
                />
              ))}
          </div>
        </section>
      ))}
      {translated.rooms.map((room, index) => (
        <section className="admin-panel-section" key={room.slug}>
          <div className="admin-section-heading">
            <h2>{content.rooms[index].title}</h2>
          </div>
          <div className="admin-form-grid">
            <AdminText
              label="Oda adı"
              value={room.title}
              onChange={(text) => roomField(index, "title", text)}
            />
            <AdminText
              label="Yatak açıklaması"
              value={room.bed}
              onChange={(text) => roomField(index, "bed", text)}
            />
            <AdminText
              label="Kısa açıklama"
              multiline
              value={room.description}
              onChange={(text) => roomField(index, "description", text)}
            />
            <AdminText
              label="Detay açıklaması"
              multiline
              value={room.longDescription}
              onChange={(text) => roomField(index, "longDescription", text)}
            />
            {room.amenities.map((amenity, amenityIndex) => (
              <AdminText
                key={amenityIndex}
                label={`Oda imkânı ${amenityIndex + 1}`}
                value={amenity}
                onChange={(text) =>
                  roomField(
                    index,
                    "amenities",
                    room.amenities.map((item, current) =>
                      current === amenityIndex ? text : item,
                    ),
                  )
                }
              />
            ))}
          </div>
        </section>
      ))}
      <section className="admin-panel-section">
        <div className="admin-section-heading">
          <h2>Hizmetler ve oda özellikleri</h2>
        </div>
        <div className="admin-form-grid">
          {translated.services.map((service, index) => (
            <AdminText
              key={index}
              label={`Hizmet ${index + 1}`}
              value={service}
              onChange={(text) =>
                update({
                  services: translated.services.map((item, current) =>
                    current === index ? text : item,
                  ),
                })
              }
            />
          ))}
          {translated.roomFeatures.map((feature, index) => (
            <div
              key={`${feature.icon}-${index}`}
              className="admin-feature-editor"
            >
              <AdminText
                label="Özellik başlığı"
                value={feature.title}
                onChange={(title) =>
                  update({
                    roomFeatures: translated.roomFeatures.map(
                      (item, current) =>
                        current === index ? { ...item, title } : item,
                    ),
                  })
                }
              />
              <AdminText
                label="Özellik açıklaması"
                multiline
                value={feature.description}
                onChange={(description) =>
                  update({
                    roomFeatures: translated.roomFeatures.map(
                      (item, current) =>
                        current === index ? { ...item, description } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>
      <section className="admin-panel-section">
        <div className="admin-section-heading">
          <h2>Galeri açıklamaları</h2>
        </div>
        <div className="admin-form-grid">
          {translated.galleryItems.map((item, index) => (
            <AdminText
              key={`${item.image}-${index}`}
              label={`Fotoğraf ${index + 1}`}
              value={item.title}
              onChange={(title) =>
                update({
                  galleryItems: translated.galleryItems.map(
                    (photo, current) => ({
                      image: photo.image,
                      title: current === index ? title : photo.title,
                    }),
                  ),
                })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
