import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { formatBookingCurrency, todayDateOnly } from "@/lib/booking";
import { getHotelCenterData, getHotelCenterStayAvailability, getHotelCenterStayPricing } from "@/lib/hotel-center";
import { isPaymentCollectionEnabled } from "@/lib/payments";
import { createReservationRequestSchema } from "@/lib/reservation-schema";
import { createReservationRequest, ReservationConflictError, ReservationOccupancyError } from "@/lib/reservations";
import { getSiteContent } from "@/lib/site-content";

export const runtime = "nodejs";

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}

const reservationFieldMessages: Record<string, string> = {
  adults: "Yetişkin sayısı geçersiz.",
  checkIn: "Giriş tarihi geçersiz.",
  checkOut: "Çıkış tarihi geçersiz.",
  children: "Çocuk sayısı geçersiz.",
  email: "E-posta adresi geçersiz.",
  name: "Ad soyad eksik veya geçersiz.",
  note: "Not alanı geçersiz.",
  phone: "Telefon numarası geçersiz.",
  roomSlug: "Oda seçimi geçersiz.",
  website: "Web sitesi alanı geçersiz."
};

function formatReservationIssue(issue: ZodError["issues"][number]) {
  const path = issue.path.join(".");

  return {
    path,
    message: issue.message === "Invalid input" ? reservationFieldMessages[path] ?? "Rezervasyon bilgisi geçersiz." : issue.message
  };
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`reservation:${getClientKey(request)}`, 6, 15 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Çok fazla talep gönderildi. Biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  try {
    const input = createReservationRequestSchema.parse(await request.json());

    if (input.website) {
      return NextResponse.json({ ok: true });
    }

    if (input.checkIn < todayDateOnly()) {
      return NextResponse.json({ error: "Giriş tarihi bugünden önce olamaz." }, { status: 400 });
    }

    const content = await getSiteContent();
    const { rooms } = content;
    const room = rooms.find((item) => item.slug === input.roomSlug);

    if (!room) {
      return NextResponse.json({ error: "Seçilen oda bulunamadı." }, { status: 400 });
    }

    const hotelCenter = await getHotelCenterData(content);
    const pricing = getHotelCenterStayPricing(room, input.checkIn, input.checkOut, hotelCenter);
    const requestItem = await createReservationRequest(input, room, pricing, (items) => {
      const availability = getHotelCenterStayAvailability(room, items, input.checkIn, input.checkOut, hotelCenter);
      const message =
        availability.nights < availability.minNights
          ? `Bu oda için seçilen tarihlerde minimum ${availability.minNights} gece konaklama gerekiyor.`
          : "Seçilen tarih aralığında bu oda için müsaitlik yok.";

      return {
        isAvailable: availability.isAvailable,
        message
      };
    });
    console.info("reservation_request_created", {
      id: requestItem.id,
      roomSlug: requestItem.roomSlug,
      checkIn: requestItem.checkIn,
      checkOut: requestItem.checkOut
    });

    return NextResponse.json({
      ok: true,
      reservation: {
        id: requestItem.id,
        estimatedTotal: requestItem.estimatedTotal,
        nights: requestItem.nights,
        paymentStatus: requestItem.paymentStatus,
        status: requestItem.status,
        totalLabel: formatBookingCurrency(requestItem.estimatedTotal, requestItem.currency)
      },
      payment: {
        required: isPaymentCollectionEnabled(),
        status: requestItem.paymentStatus
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Rezervasyon bilgilerinde eksik veya hatalı alan var.",
          issues: error.issues.map(formatReservationIssue)
        },
        { status: 400 }
      );
    }

    if (error instanceof ReservationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof ReservationOccupancyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("reservation_request_failed", error);
    return NextResponse.json({ error: "Rezervasyon talebi alınamadı." }, { status: 500 });
  }
}
