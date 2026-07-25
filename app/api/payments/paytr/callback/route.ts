import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPaytrCallbackHash } from "@/lib/payments";
import { settleReservationPaymentByReference } from "@/lib/reservations";
import { getSiteContent } from "@/lib/site-content";

export const runtime = "nodejs";

const paytrCallbackSchema = z.object({
  failed_reason_msg: z.string().max(500).optional().default(""),
  hash: z.string().min(10).max(500),
  merchant_oid: z.string().min(4).max(140),
  status: z.enum(["success", "failed"]),
  total_amount: z.string().regex(/^\d+$/)
});

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const parsed = paytrCallbackSchema.safeParse(
    formData
      ? {
          failed_reason_msg: formData.get("failed_reason_msg")?.toString() ?? "",
          hash: formData.get("hash")?.toString() ?? "",
          merchant_oid: formData.get("merchant_oid")?.toString() ?? "",
          status: formData.get("status")?.toString() ?? "",
          total_amount: formData.get("total_amount")?.toString() ?? ""
        }
      : null
  );

  if (!parsed.success) {
    console.warn("paytr_callback_invalid_payload");
    return NextResponse.json({ error: "Geçersiz callback." }, { status: 400 });
  }

  const callback = parsed.data;
  const isValidHash = verifyPaytrCallbackHash({
    hash: callback.hash,
    merchantOid: callback.merchant_oid,
    status: callback.status,
    totalAmount: callback.total_amount
  });

  if (!isValidHash) {
    console.warn("paytr_callback_hash_mismatch", { merchantOid: callback.merchant_oid });
    return NextResponse.json({ error: "Geçersiz imza." }, { status: 400 });
  }

  const { rooms } = await getSiteContent();
  const amount = Math.round(Number(callback.total_amount) / 100);
  const reservation = await settleReservationPaymentByReference({
    amount,
    failureReason: callback.failed_reason_msg,
    isSuccessful: callback.status === "success",
    provider: "paytr",
    reference: callback.merchant_oid,
    rooms
  });

  if (!reservation) {
    console.warn("paytr_callback_unknown_reference", { merchantOid: callback.merchant_oid });
  } else {
    console.info("paytr_callback_processed", {
      paymentStatus: reservation.paymentStatus,
      reference: callback.merchant_oid,
      reservationId: reservation.id
    });
  }

  return new NextResponse("OK", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
