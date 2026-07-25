import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyMockPaymentToken } from "@/lib/payments";
import { getReservationRequestById, settleReservationPaymentByReference } from "@/lib/reservations";
import { getSiteContent } from "@/lib/site-content";

export const runtime = "nodejs";

const mockPaymentSchema = z.object({
  reference: z.string().min(4).max(140),
  reservationId: z.string().uuid(),
  result: z.enum(["success", "failed"]),
  token: z.string().min(32).max(256)
});

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const parsed = mockPaymentSchema.safeParse(
    formData
      ? {
          reference: formData.get("reference")?.toString() ?? "",
          reservationId: formData.get("reservationId")?.toString() ?? "",
          result: formData.get("result")?.toString() ?? "",
          token: formData.get("token")?.toString() ?? ""
        }
      : null
  );

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/odeme/basarisiz?reason=invalid", request.url), 303);
  }

  const reservation = await getReservationRequestById(parsed.data.reservationId);

  if (
    !reservation ||
    reservation.paymentReference !== parsed.data.reference ||
    !verifyMockPaymentToken(
      parsed.data.reservationId,
      parsed.data.reference,
      reservation.paymentAmount,
      parsed.data.token
    )
  ) {
    return NextResponse.redirect(new URL("/odeme/basarisiz?reason=invalid", request.url), 303);
  }

  const { rooms } = await getSiteContent();
  await settleReservationPaymentByReference({
    amount: reservation.paymentAmount,
    failureReason: parsed.data.result === "failed" ? "Mock ödeme başarısız seçildi." : "",
    isSuccessful: parsed.data.result === "success",
    provider: "mock",
    reference: parsed.data.reference,
    rooms
  });

  const target = parsed.data.result === "success" ? "/odeme/basarili" : "/odeme/basarisiz";
  return NextResponse.redirect(new URL(`${target}?reservationId=${reservation.id}`, request.url), 303);
}
