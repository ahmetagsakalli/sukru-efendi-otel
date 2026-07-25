import crypto from "node:crypto";
import { z } from "zod";
import type { PaymentProvider, PaymentStatus, ReservationRequest } from "@/lib/reservation-schema";

export const paymentRuntimeProviderSchema = z.enum(["disabled", "mock", "paytr"]);

const PAYTR_TOKEN_URL = "https://www.paytr.com/odeme/api/get-token";
const DEFAULT_PAYMENT_HOLD_MINUTES = 30;

export class PaymentConfigurationError extends Error {
  constructor(message = "Ödeme altyapısı henüz yapılandırılmamış.") {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}

export class PaymentProviderError extends Error {
  constructor(message = "Ödeme sağlayıcısı yanıt vermedi.") {
    super(message);
    this.name = "PaymentProviderError";
  }
}

export type PaymentSession = {
  amount: number;
  currency: "TRY";
  provider: Exclude<PaymentProvider, "manual">;
  reference: string;
  redirectUrl: string;
};

function getRuntimeProvider() {
  const rawProvider = process.env.PAYMENT_PROVIDER?.trim().toLocaleLowerCase("en-US") || "disabled";
  const parsed = paymentRuntimeProviderSchema.safeParse(rawProvider);
  return parsed.success ? parsed.data : "disabled";
}

function getNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export function getPaymentHoldMinutes() {
  return Math.max(5, Math.min(180, Math.round(getNumberEnv("PAYMENT_HOLD_MINUTES", DEFAULT_PAYMENT_HOLD_MINUTES))));
}

export function isPaymentCollectionEnabled() {
  return getRuntimeProvider() !== "disabled";
}

export function getInitialPaymentFields() {
  const runtimeProvider = getRuntimeProvider();

  if (runtimeProvider === "disabled") {
    return {
      paymentProvider: "manual" as PaymentProvider,
      paymentStatus: "not_required" as PaymentStatus
    };
  }

  return {
    paymentProvider: runtimeProvider as PaymentProvider,
    paymentStatus: "pending" as PaymentStatus
  };
}

export function getReservationPaymentAmount(reservation: Pick<ReservationRequest, "estimatedTotal">) {
  const mode = process.env.PAYMENT_AMOUNT_MODE?.trim().toLocaleLowerCase("en-US") || "full";
  const total = Math.max(0, Math.round(reservation.estimatedTotal));

  if (mode === "fixed") {
    return Math.max(1, Math.round(getNumberEnv("PAYMENT_FIXED_AMOUNT", total)));
  }

  if (mode === "deposit_percent") {
    const percent = Math.max(1, Math.min(100, getNumberEnv("PAYMENT_DEPOSIT_PERCENT", 30)));
    return Math.max(1, Math.round((total * percent) / 100));
  }

  return total;
}

export function isPaymentHoldActive(reservation: Pick<ReservationRequest, "paymentStartedAt" | "paymentStatus">) {
  if (reservation.paymentStatus !== "processing") {
    return false;
  }

  const startedAt = new Date(reservation.paymentStartedAt).getTime();

  if (!Number.isFinite(startedAt)) {
    return false;
  }

  return Date.now() - startedAt <= getPaymentHoldMinutes() * 60 * 1000;
}

function hmacBase64(value: string, key: string) {
  return crypto.createHmac("sha256", key).update(value).digest("base64");
}

function hmacHex(value: string, key: string) {
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getPaymentBaseUrl(request: Request) {
  const configured = process.env.PAYMENT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return new URL(request.url).origin;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "127.0.0.1";
}

function getMockSecret() {
  const secret = process.env.PAYMENT_MOCK_SECRET || process.env.ADMIN_SESSION_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new PaymentConfigurationError("PAYMENT_MOCK_SECRET production ortamında zorunlu.");
  }

  return secret || "dev-payment-mock-secret";
}

export function signMockPaymentToken(reservationId: string, reference: string, amount: number) {
  return hmacHex(`${reservationId}:${reference}:${amount}`, getMockSecret());
}

export function verifyMockPaymentToken(reservationId: string, reference: string, amount: number, token: string) {
  return safeEqual(signMockPaymentToken(reservationId, reference, amount), token);
}

function getPaytrConfig() {
  const merchantId = process.env.PAYTR_MERCHANT_ID;
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new PaymentConfigurationError("PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY ve PAYTR_MERCHANT_SALT gerekli.");
  }

  return {
    merchantId,
    merchantKey,
    merchantSalt,
    debugOn: process.env.PAYTR_DEBUG_ON === "1" ? "1" : "0",
    maxInstallment: process.env.PAYTR_MAX_INSTALLMENT ?? "0",
    noInstallment: process.env.PAYTR_NO_INSTALLMENT ?? "0",
    testMode: process.env.PAYTR_TEST_MODE === "0" ? "0" : "1",
    timeoutLimit: process.env.PAYTR_TIMEOUT_LIMIT ?? "30"
  };
}

function buildReference(provider: "mock" | "paytr", reservationId: string) {
  const compactId = reservationId.replace(/-/g, "").slice(0, 24);
  return `${provider.toUpperCase()}${compactId}${Date.now().toString(36)}`.slice(0, 64);
}

function safePaymentEmail(reservation: ReservationRequest) {
  const email = reservation.email.trim();
  return email || `rezervasyon-${reservation.id.slice(0, 8)}@sukruefendiotel.com`;
}

export async function createPaymentSession({
  request,
  reservation
}: {
  request: Request;
  reservation: ReservationRequest;
}): Promise<PaymentSession> {
  const provider = getRuntimeProvider();
  const amount = getReservationPaymentAmount(reservation);

  if (provider === "disabled") {
    throw new PaymentConfigurationError("Ödeme altyapısı aktif değil.");
  }

  if (amount <= 0) {
    throw new PaymentConfigurationError("Ödeme tutarı geçersiz.");
  }

  if (provider === "mock") {
    const reference = buildReference("mock", reservation.id);
    const token = signMockPaymentToken(reservation.id, reference, amount);
    const redirectUrl = `${getPaymentBaseUrl(request)}/odeme/test?reservationId=${reservation.id}&reference=${reference}&token=${token}`;

    return {
      amount,
      currency: "TRY",
      provider: "mock",
      reference,
      redirectUrl
    };
  }

  const config = getPaytrConfig();
  const reference = buildReference("paytr", reservation.id);
  const paymentAmount = String(amount * 100);
  const currency = "TL";
  const userBasket = Buffer.from(JSON.stringify([[reservation.roomTitle, String(amount), 1]])).toString("base64");
  const tokenPayload = [
    config.merchantId,
    getClientIp(request),
    reference,
    safePaymentEmail(reservation),
    paymentAmount,
    userBasket,
    config.noInstallment,
    config.maxInstallment,
    currency,
    config.testMode
  ].join("");
  const paytrToken = hmacBase64(`${tokenPayload}${config.merchantSalt}`, config.merchantKey);
  const baseUrl = getPaymentBaseUrl(request);
  const formData = new URLSearchParams({
    merchant_id: config.merchantId,
    user_ip: getClientIp(request),
    merchant_oid: reference,
    email: safePaymentEmail(reservation),
    payment_amount: paymentAmount,
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: config.debugOn,
    no_installment: config.noInstallment,
    max_installment: config.maxInstallment,
    user_name: reservation.name,
    user_address: process.env.PAYTR_USER_ADDRESS_FALLBACK || "Ordu",
    user_phone: reservation.phone,
    merchant_ok_url: `${baseUrl}/odeme/basarili?reservationId=${reservation.id}`,
    merchant_fail_url: `${baseUrl}/odeme/basarisiz?reservationId=${reservation.id}`,
    timeout_limit: config.timeoutLimit,
    currency,
    test_mode: config.testMode,
    lang: "tr"
  });

  const response = await fetch(PAYTR_TOKEN_URL, {
    body: formData,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  const result = (await response.json().catch(() => null)) as { reason?: string; status?: string; token?: string } | null;

  if (!response.ok || result?.status !== "success" || !result.token) {
    throw new PaymentProviderError(result?.reason || "PayTR ödeme tokenı alınamadı.");
  }

  return {
    amount,
    currency: "TRY",
    provider: "paytr",
    reference,
    redirectUrl: `${baseUrl}/odeme/paytr?token=${encodeURIComponent(result.token)}&reservationId=${reservation.id}`
  };
}

export function verifyPaytrCallbackHash({
  hash,
  merchantOid,
  status,
  totalAmount
}: {
  hash: string;
  merchantOid: string;
  status: string;
  totalAmount: string;
}) {
  const config = getPaytrConfig();
  const expected = hmacBase64(`${merchantOid}${config.merchantSalt}${status}${totalAmount}`, config.merchantKey);
  return safeEqual(expected, hash);
}
