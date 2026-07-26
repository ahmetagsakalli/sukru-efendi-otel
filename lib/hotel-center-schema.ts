import { z } from "zod";

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const hotelCenterDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih formatı geçersiz.")
  .refine(isValidDateOnly, "Tarih geçersiz.");

export const hotelCenterSettingsSchema = z.object({
  baseUrl: z.string().trim().url("Site adresi geçersiz.").max(300),
  defaultAdults: z.coerce.number().int("Varsayılan yetişkin sayısı geçersiz.").min(1).max(8).default(2),
  enabled: z.coerce.boolean().default(false),
  hotelId: z
    .string()
    .trim()
    .min(2, "Google otel kodu eksik.")
    .max(90, "Google otel kodu çok uzun.")
    .regex(/^[a-zA-Z0-9_-]+$/, "Google otel kodu harf, rakam, tire ve alt çizgi içermeli."),
  landingPagePath: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((value) => value.startsWith("/") && !value.includes(".."), "Rezervasyon yolu / ile başlamalı."),
  maxAdvanceDays: z.coerce.number().int("Takvim aralığı geçersiz.").min(1).max(730).default(365),
  partnerKey: z
    .string()
    .trim()
    .min(2, "Partner anahtarı eksik.")
    .max(90, "Partner anahtarı çok uzun.")
    .regex(/^[a-zA-Z0-9_-]+$/, "Partner anahtarı harf, rakam, tire ve alt çizgi içermeli."),
  partnerName: z.string().trim().min(2, "Partner adı eksik.").max(120, "Partner adı çok uzun."),
  pointOfSaleId: z
    .string()
    .trim()
    .min(2, "Satış noktası kodu eksik.")
    .max(60, "Satış noktası kodu çok uzun.")
    .regex(/^[a-zA-Z0-9_-]+$/, "Satış noktası kodu harf, rakam, tire ve alt çizgi içermeli.")
    .default("direct"),
  pricesIncludeTax: z.coerce.boolean().default(true),
  ratePlanCode: z
    .string()
    .trim()
    .min(2, "Fiyat planı kodu eksik.")
    .max(60, "Fiyat planı kodu çok uzun.")
    .regex(/^[a-zA-Z0-9_-]+$/, "Fiyat planı kodu harf, rakam, tire ve alt çizgi içermeli."),
  updatedAt: z.string().trim().max(80).optional().default("")
});

export const hotelCenterRateSchema = z.object({
  availableRooms: z.coerce.number().int("Müsait oda sayısı geçersiz.").min(0).max(200),
  closed: z.coerce.boolean().default(false),
  date: hotelCenterDateSchema,
  minNights: z.coerce.number().int("Minimum gece geçersiz.").min(1).max(30).default(1),
  pricePerNight: z.coerce
    .number()
    .int("Gecelik fiyat geçersiz.")
    .min(0, "Gecelik fiyat negatif olamaz.")
    .max(1_000_000, "Gecelik fiyat çok yüksek."),
  roomSlug: z.string().trim().min(2, "Oda seçimi eksik.").max(90, "Oda seçimi geçersiz."),
  updatedAt: z.string().trim().max(80).optional().default("")
});

export const hotelCenterDataSchema = z.object({
  rates: z.array(hotelCenterRateSchema).max(30_000).default([]),
  settings: hotelCenterSettingsSchema,
  updatedAt: z.string().trim().max(80).optional().default("")
});

export type HotelCenterData = z.infer<typeof hotelCenterDataSchema>;
export type HotelCenterRate = z.infer<typeof hotelCenterRateSchema>;
export type HotelCenterSettings = z.infer<typeof hotelCenterSettingsSchema>;
