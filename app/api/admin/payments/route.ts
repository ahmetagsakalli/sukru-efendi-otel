import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminSession } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getReservationRequestById, updateReservationPaymentState } from "@/lib/reservations";

export const runtime = "nodejs";

const adminPaymentActionSchema = z.object({
  action: z.enum(["mark_paid", "mark_failed", "mark_cancelled", "mark_refunded", "clear_payment"]),
  amount: z.coerce.number().int().min(0).max(30_000_000).optional(),
  id: z.string().uuid(),
  note: z.string().trim().max(500).optional().default("")
});

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}

async function requireAdmin() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 });
  }

  return null;
}

function appendAdminNote(existingNote: string, note: string) {
  return [existingNote, note].filter(Boolean).join("\n");
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const rate = checkRateLimit(`admin-payment:${getClientKey(request)}`, 30, 15 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Çok fazla ödeme güncellemesi yapıldı. Biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  const parsed = adminPaymentActionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz ödeme işlemi." }, { status: 400 });
  }

  const input = parsed.data;
  const reservation = await getReservationRequestById(input.id);

  if (!reservation) {
    return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const baseAmount = reservation.paymentAmount > 0 ? reservation.paymentAmount : reservation.estimatedTotal;
  const amount = input.amount ?? baseAmount;
  const note = input.note ? `[Ödeme] ${input.note}` : "";
  const adminNote = note ? appendAdminNote(reservation.adminNote, note) : reservation.adminNote;
  const existingProvider = reservation.paymentStatus === "not_required" ? "manual" : reservation.paymentProvider;
  let patch: Parameters<typeof updateReservationPaymentState>[1];

  switch (input.action) {
    case "mark_paid":
      patch = {
        adminNote,
        paidAt: reservation.paidAt || now,
        paymentAmount: amount,
        paymentCurrency: "TRY",
        paymentFailureReason: "",
        paymentProvider: "manual",
        paymentStatus: "paid",
        status: reservation.status === "archived" ? reservation.status : "confirmed"
      };
      break;
    case "mark_failed":
      patch = {
        adminNote,
        paymentAmount: amount,
        paymentCurrency: "TRY",
        paymentFailureReason: input.note || "Panelden başarısız işaretlendi.",
        paymentProvider: existingProvider,
        paymentStatus: "failed",
        status: reservation.status === "confirmed" ? "contacted" : reservation.status
      };
      break;
    case "mark_cancelled":
      patch = {
        adminNote,
        paymentAmount: amount,
        paymentCurrency: "TRY",
        paymentFailureReason: input.note || "Panelden iptal edildi.",
        paymentProvider: existingProvider,
        paymentStatus: "cancelled",
        status: "cancelled"
      };
      break;
    case "mark_refunded":
      patch = {
        adminNote,
        paymentAmount: amount,
        paymentCurrency: "TRY",
        paymentFailureReason: input.note || "Panelden iade edildi.",
        paymentProvider: existingProvider,
        paymentStatus: "refunded",
        status: reservation.status === "archived" ? reservation.status : "cancelled"
      };
      break;
    case "clear_payment":
      patch = {
        adminNote,
        paidAt: "",
        paymentAmount: 0,
        paymentCurrency: "TRY",
        paymentFailureReason: "",
        paymentProvider: "manual",
        paymentReference: "",
        paymentRedirectUrl: "",
        paymentStartedAt: "",
        paymentStatus: "not_required",
        status: reservation.status
      };
      break;
  }

  const updated = await updateReservationPaymentState(input.id, patch);

  if (!updated) {
    return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
  }

  console.info("admin_payment_updated", {
    action: input.action,
    paymentStatus: updated.paymentStatus,
    reservationId: updated.id
  });

  return NextResponse.json({ ok: true, reservation: updated });
}
