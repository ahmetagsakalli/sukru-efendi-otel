import { z } from "zod";

const text = (max = 300) => z.string().trim().min(1).max(max);
const optionalText = (max = 300) => z.string().trim().max(max).optional().default("");

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
    "Geçerli bir bağlantı girin."
  );

export const imagePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => value.startsWith("/") && !value.includes(".."), "Görsel yolu / ile başlamalı.");

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
  canonicalUrl: z.string().trim().url().max(300)
});

export const roomToneSchema = z.enum(["room", "suite", "family"]);
export const roomFeatureIconSchema = z.enum(["smart-entry", "safe", "wifi"]);

export const roomFeatureSchema = z.object({
  icon: roomFeatureIconSchema,
  title: text(90),
  description: text(360)
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
  amenities: z.array(text(100)).min(1).max(40)
});

export const galleryItemSchema = z.object({
  title: text(120),
  tone: text(60),
  image: imagePathSchema
});

export const homePageContentSchema = z.object({
  heroTitle: text(120),
  heroEmphasis: text(120),
  heroLead: text(500),
  heroImage: imagePathSchema,
  historyTitle: text(220),
  historyText: text(800),
  historyImage: imagePathSchema
});

export const simpleIntroSchema = z.object({
  title: text(240),
  body: text(900)
});

export const contactPageContentSchema = simpleIntroSchema.extend({
  contactTitle: text(120),
  locationTitle: text(120)
});

export const historyPageContentSchema = simpleIntroSchema.extend({
  image: imagePathSchema,
  timeline: z.array(text(260)).min(1).max(12)
});

export const pagesContentSchema = z.object({
  home: homePageContentSchema,
  rooms: simpleIntroSchema,
  gallery: simpleIntroSchema,
  contact: contactPageContentSchema,
  history: historyPageContentSchema
});

export const siteContentSchema = z.object({
  site: siteInfoSchema,
  pages: pagesContentSchema,
  services: z.array(text(120)).min(1).max(40),
  roomFeatures: z.array(roomFeatureSchema).min(1).max(12),
  rooms: z.array(roomSchema).min(1).max(30),
  galleryItems: z.array(galleryItemSchema).min(1).max(120),
  updatedAt: optionalText(80)
});

export type SiteInfo = z.infer<typeof siteInfoSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;
export type Room = z.infer<typeof roomSchema>;
export type RoomFeature = z.infer<typeof roomFeatureSchema>;
export type GalleryItem = z.infer<typeof galleryItemSchema>;
export type AdminImage = {
  src: string;
  name: string;
  size: number;
  updatedAt: string;
};
