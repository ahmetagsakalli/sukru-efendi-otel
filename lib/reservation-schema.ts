import { z } from "zod";

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateIsAfter(checkOut: string, checkIn: string) {
  if (!isValidDateOnly(checkIn) || !isValidDateOnly(checkOut)) {
    return false;
  }

  return new Date(`${checkOut}T00:00:00Z`).getTime() > new Date(`${checkIn}T00:00:00Z`).getTime();
}

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih formatı geçersiz.")
  .refine(isValidDateOnly, "Tarih geçersiz.");
const emailValueSchema = z
  .string()
  .trim()
  .max(180, "E-posta adresi çok uzun.")
  .refine((value) => value === "" || z.string().email().safeParse(value).success, "E-posta adresi geçersiz.");
const optionalTextSchema = (max: number, message: string) => z.string().trim().max(max, message).optional();
const storedTextSchema = (max: number, message: string) => z.string().trim().max(max, message).default("");
const dateOrderMessage = "Çıkış tarihi giriş tarihinden sonra olmalı.";
const adminPricePerNightSchema = z.coerce
  .number()
  .int("Gecelik fiyat geçersiz.")
  .min(0, "Gecelik fiyat negatif olamaz.")
  .max(1_000_000, "Gecelik fiyat çok yüksek.");

export const reservationSourceSchema = z.enum(["website", "admin"]);
export const reservationStatusSchema = z.enum(["new", "contacted", "confirmed", "cancelled", "archived"]);
export const paymentProviderSchema = z.enum(["manual", "mock", "paytr"]).default("manual");
export const paymentStatusSchema = z
  .enum(["not_required", "pending", "processing", "paid", "failed", "cancelled", "refunded"])
  .default("not_required");

export const createReservationRequestSchema = z
  .object({
    checkIn: dateSchema,
    checkOut: dateSchema,
    roomSlug: z.string().trim().min(2, "Oda seçimi eksik.").max(90, "Oda seçimi geçersiz."),
    adults: z.coerce.number().int("Yetişkin sayısı geçersiz.").min(1, "En az 1 yetişkin seçilmeli.").max(8, "Yetişkin sayısı çok yüksek."),
    children: z.coerce.number().int("Çocuk sayısı geçersiz.").min(0, "Çocuk sayısı geçersiz.").max(8, "Çocuk sayısı çok yüksek."),
    name: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı.").max(120, "Ad soyad çok uzun."),
    phone: z
      .string()
      .trim()
      .min(7, "Telefon numarası eksik.")
      .max(40, "Telefon numarası çok uzun.")
      .regex(/^[+()0-9\s-]+$/, "Telefon numarası geçersiz."),
    email: emailValueSchema.optional(),
    note: optionalTextSchema(700, "Not çok uzun."),
    website: optionalTextSchema(200, "Web sitesi alanı geçersiz.")
  })
  .refine((value) => dateIsAfter(value.checkOut, value.checkIn), {
    message: dateOrderMessage,
    path: ["checkOut"]
  });

export const availabilityQuerySchema = z
  .object({
    checkIn: dateSchema,
    checkOut: dateSchema,
    roomSlug: z.string().trim().min(2).max(90).optional()
  })
  .refine((value) => dateIsAfter(value.checkOut, value.checkIn), {
    message: dateOrderMessage,
    path: ["checkOut"]
  });

export const adminCreateReservationSchema = z
  .object({
    checkIn: dateSchema,
    checkOut: dateSchema,
    roomSlug: z.string().trim().min(2, "Oda seçimi eksik.").max(90, "Oda seçimi geçersiz."),
    adults: z.coerce.number().int("Yetişkin sayısı geçersiz.").min(1, "En az 1 yetişkin seçilmeli.").max(8, "Yetişkin sayısı çok yüksek."),
    children: z.coerce.number().int("Çocuk sayısı geçersiz.").min(0, "Çocuk sayısı geçersiz.").max(8, "Çocuk sayısı çok yüksek."),
    name: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı.").max(120, "Ad soyad çok uzun."),
    phone: z
      .string()
      .trim()
      .min(7, "Telefon numarası eksik.")
      .max(40, "Telefon numarası çok uzun.")
      .regex(/^[+()0-9\s-]+$/, "Telefon numarası geçersiz."),
    email: emailValueSchema.default(""),
    note: storedTextSchema(700, "Not çok uzun."),
    adminNote: storedTextSchema(700, "Panel notu çok uzun."),
    pricePerNight: adminPricePerNightSchema.optional(),
    status: reservationStatusSchema.default("confirmed")
  })
  .refine((value) => dateIsAfter(value.checkOut, value.checkIn), {
    message: dateOrderMessage,
    path: ["checkOut"]
  });

export const reservationRequestSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: reservationStatusSchema,
  source: reservationSourceSchema.default("website"),
  checkIn: dateSchema,
  checkOut: dateSchema,
  roomSlug: z.string().trim().min(2).max(90),
  roomTitle: z.string().trim().min(1).max(120),
  adults: z.number().int().min(1).max(8),
  children: z.number().int().min(0).max(8),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(40),
  email: emailValueSchema.default(""),
  note: storedTextSchema(700, "Not çok uzun."),
  adminNote: storedTextSchema(700, "Panel notu çok uzun."),
  nights: z.number().int().min(1).max(90).default(1),
  pricePerNight: z.number().int().min(0).max(1_000_000).default(0),
  estimatedTotal: z.number().int().min(0).max(30_000_000).default(0),
  currency: z.literal("TRY").default("TRY"),
  paymentStatus: paymentStatusSchema,
  paymentProvider: paymentProviderSchema,
  paymentReference: storedTextSchema(140, "Ödeme referansı çok uzun."),
  paymentAmount: z.number().int().min(0).max(30_000_000).default(0),
  paymentCurrency: z.literal("TRY").default("TRY"),
  paymentStartedAt: storedTextSchema(80, "Ödeme başlangıç tarihi geçersiz."),
  paymentUpdatedAt: storedTextSchema(80, "Ödeme güncelleme tarihi geçersiz."),
  paidAt: storedTextSchema(80, "Ödeme tarihi geçersiz."),
  paymentFailureReason: storedTextSchema(500, "Ödeme hata mesajı çok uzun."),
  paymentRedirectUrl: storedTextSchema(900, "Ödeme bağlantısı çok uzun.")
});

export const updateReservationRequestSchema = z
  .object({
    id: z.string().uuid(),
    status: reservationStatusSchema,
    checkIn: dateSchema,
    checkOut: dateSchema,
    roomSlug: z.string().trim().min(2, "Oda seçimi eksik.").max(90, "Oda seçimi geçersiz."),
    adults: z.coerce.number().int("Yetişkin sayısı geçersiz.").min(1, "En az 1 yetişkin seçilmeli.").max(8, "Yetişkin sayısı çok yüksek."),
    children: z.coerce.number().int("Çocuk sayısı geçersiz.").min(0, "Çocuk sayısı geçersiz.").max(8, "Çocuk sayısı çok yüksek."),
    name: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı.").max(120, "Ad soyad çok uzun."),
    phone: z
      .string()
      .trim()
      .min(7)
      .max(40)
      .regex(/^[+()0-9\s-]+$/, "Telefon numarası geçersiz."),
    email: emailValueSchema.default(""),
    note: storedTextSchema(700, "Not çok uzun."),
    adminNote: storedTextSchema(700, "Panel notu çok uzun."),
    pricePerNight: adminPricePerNightSchema.optional()
  })
  .refine((value) => dateIsAfter(value.checkOut, value.checkIn), {
    message: dateOrderMessage,
    path: ["checkOut"]
  });

export type AdminCreateReservationInput = z.infer<typeof adminCreateReservationSchema>;
export type CreateReservationRequestInput = z.infer<typeof createReservationRequestSchema>;
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;
export type ReservationRequest = z.infer<typeof reservationRequestSchema>;
