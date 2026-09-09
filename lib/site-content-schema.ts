import { z } from "zod";

const text = (max = 300) =>
  z
    .string()
    .trim()
    .min(1, "Bu alan boş bırakılamaz.")
    .max(max, `En fazla ${max} karakter girebilirsiniz.`);
const optionalText = (max = 300) =>
  z.string().trim().max(max).optional().default("");

const linkSchema = z
  .string()
  .trim()
  .min(1)
  .max(900)
  .refine(
    (value) =>
      value.startsWith("/") ||
      value.startsWith("tel:") ||
      value.startsWith("mailto:") ||
      value.startsWith("https://") ||
      value.startsWith("http://"),
    "Geçerli bir bağlantı girin.",
  );

export const imagePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (value) => value.startsWith("/") && !value.includes(".."),
    "Görsel yolu / ile başlamalı.",
  );

export const siteInfoSchema = z.object({
  name: text(120),
  shortName: text(80),
  description: text(700),
  phone: text(40),
  phoneHref: linkSchema,
  whatsapp: text(40),
  whatsappHref: linkSchema,
  email: z.string().trim().email().max(160),
  emailHref: linkSchema,
  address: text(500),
  mapHref: linkSchema,
  mapEmbed: linkSchema,
  canonicalUrl: z.string().trim().url().max(300),
});

export const roomToneSchema = z.enum(["room", "suite", "family"]);
export const roomFeatureIconSchema = z.enum(["smart-entry", "safe", "wifi"]);

export const roomFeatureSchema = z.object({
  icon: roomFeatureIconSchema,
  title: text(90),
  description: text(360),
});

export const roomSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(90)
    .regex(/^[a-z0-9-]+$/, "Slug küçük harf, rakam ve tire içermeli."),
  title: text(120),
  description: text(500),
  longDescription: text(1200),
  count: z.coerce.number().int().min(0).max(200),
  size: text(60),
  capacity: text(80),
  bed: text(120),
  price: text(80),
  image: imagePathSchema,
  tone: roomToneSchema,
  gallery: z.array(imagePathSchema).min(1).max(36),
  amenities: z.array(text(100)).min(1).max(40),
});

export const galleryItemSchema = z.object({
  title: text(120),
  tone: text(60),
  image: imagePathSchema,
});

export const homePageContentSchema = z.object({
  heroTitle: text(120),
  heroEmphasis: text(120),
  heroLead: text(500),
  heroImage: imagePathSchema,
  historyTitle: text(220),
  historyText: text(800),
  historyImage: imagePathSchema,
});

export const simpleIntroSchema = z.object({
  title: text(240),
  body: text(900),
});

export const contactPageContentSchema = simpleIntroSchema.extend({
  contactTitle: text(120),
  locationTitle: text(120),
});

export const historyPageContentSchema = simpleIntroSchema.extend({
  image: imagePathSchema,
  timeline: z.array(text(260)).min(1).max(12),
});

export const pagesContentSchema = z.object({
  home: homePageContentSchema,
  rooms: simpleIntroSchema,
  gallery: simpleIntroSchema,
  contact: contactPageContentSchema,
  history: historyPageContentSchema,
});

export const bookingTextSchema = z
  .object({
    title: text(120),
    introduction: text(500),
    heritage: text(120),
    heritageNote: text(260),
    guestTitle: text(120),
    guestIntroduction: text(500),
    continue: text(80),
    notePrompt: text(200),
    successTitle: text(160),
  })
  .partial();

export const bookingSettingsSchema = z
  .object({
    heritageYears: z.coerce.number().int().min(1).max(2000).default(400),
    copy: z
      .object({
        tr: bookingTextSchema.default({}),
        en: bookingTextSchema.default({}),
        de: bookingTextSchema.default({}),
      })
      .default({ tr: {}, en: {}, de: {} }),
  })
  .default({ heritageYears: 400, copy: { tr: {}, en: {}, de: {} } });

export const siteTranslationSchema = z.object({
  siteDescription: text(700).optional(),
  pages: z
    .object({
      home: homePageContentSchema
        .omit({ heroImage: true, historyImage: true })
        .partial()
        .optional(),
      rooms: simpleIntroSchema.partial().optional(),
      gallery: simpleIntroSchema.partial().optional(),
      contact: contactPageContentSchema.partial().optional(),
      history: historyPageContentSchema
        .omit({ image: true })
        .partial()
        .optional(),
    })
    .optional(),
  services: z.array(text(120)).min(1).max(40).optional(),
  rooms: z
    .array(
      roomSchema.pick({
        slug: true,
        title: true,
        description: true,
        longDescription: true,
        bed: true,
        amenities: true,
      }),
    )
    .max(30)
    .optional(),
  roomFeatures: z.array(roomFeatureSchema).max(12).optional(),
  galleryItems: z
    .array(z.object({ image: imagePathSchema, title: text(120) }))
    .max(120)
    .optional(),
});

export const siteContentSchema = z.object({
  site: siteInfoSchema,
  pages: pagesContentSchema,
  services: z.array(text(120)).min(1).max(40),
  roomFeatures: z.array(roomFeatureSchema).min(1).max(12),
  rooms: z
    .array(roomSchema)
    .min(1)
    .max(30)
    .refine(
      (rooms) => new Set(rooms.map((room) => room.slug)).size === rooms.length,
      "Oda sayfa adresleri birbirinden farklı olmalı.",
    ),
  galleryItems: z.array(galleryItemSchema).min(1).max(120),
  booking: bookingSettingsSchema,
  translations: z
    .object({
      en: siteTranslationSchema.optional(),
      de: siteTranslationSchema.optional(),
    })
    .default({}),
  updatedAt: optionalText(80),
});

export type SiteInfo = z.infer<typeof siteInfoSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;
export type Room = z.infer<typeof roomSchema>;
export type RoomFeature = z.infer<typeof roomFeatureSchema>;
export type GalleryItem = z.infer<typeof galleryItemSchema>;
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;
export type BookingText = z.infer<typeof bookingTextSchema>;
export type SiteTranslation = z.infer<typeof siteTranslationSchema>;
export type AdminImage = {
  src: string;
  name: string;
  size: number;
  updatedAt: string;
};
