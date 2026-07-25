import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { createPaymentSession, PaymentConfigurationError, PaymentProviderError } from "@/lib/payments";
import { getReservationRequestById, updateReservationPaymentState } from "@/lib/reservations";

export const runtime = "nodejs";

const paymentCreateSchema = z.object({
  reservationId: z.string().uuid()
});

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`payment-create:${getClientKey(request)}`, 8, 15 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Çok fazla ödeme başlatma isteği gönderildi. Biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  const parsed = paymentCreateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz ödeme isteği." }, { status: 400 });
  }

  const reservation = await getReservationRequestById(parsed.data.reservationId);

  if (!reservation) {
    return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
  }

  if (reservation.status === "cancelled" || reservation.status === "archived") {
    return NextResponse.json({ error: "İptal veya arşiv kayıtları için ödeme başlatılamaz." }, { status: 409 });
  }

  if (reservation.paymentStatus === "paid") {
    return NextResponse.json({ error: "Bu rezervasyonun ödemesi zaten alınmış." }, { status: 409 });
  }

  try {
    const session = await createPaymentSession({ request, reservation });
    const updated = await updateReservationPaymentState(reservation.id, {
      paymentAmount: session.amount,
      paymentCurrency: session.currency,
      paymentFailureReason: "",
      paymentProvider: session.provider,
      paymentRedirectUrl: session.redirectUrl,
      paymentReference: session.reference,
      paymentStartedAt: new Date().toISOString(),
      paymentStatus: "processing"
    });

    if (!updated) {
      return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
    }

    console.info("payment_session_created", {
      provider: session.provider,
      reference: session.reference,
      reservationId: reservation.id
    });

    return NextResponse.json({
      ok: true,
      payment: {
        amount: session.amount,
        currency: session.currency,
        provider: session.provider,
        redirectUrl: session.redirectUrl,
        reference: session.reference,
        status: updated.paymentStatus
      }
    });
  } catch (error) {
    if (error instanceof PaymentConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof PaymentProviderError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    console.error("payment_session_create_failed", error);
    return NextResponse.json({ error: "Ödeme başlatılamadı." }, { status: 500 });
  }
}
