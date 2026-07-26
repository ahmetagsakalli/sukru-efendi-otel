import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { formatBookingCurrency, todayDateOnly } from "@/lib/booking";
import { getHotelCenterData, getHotelCenterStayAvailability } from "@/lib/hotel-center";
import { availabilityQuerySchema } from "@/lib/reservation-schema";
import { listReservationRequests } from "@/lib/reservations";
import { getSiteContent } from "@/lib/site-content";

export const runtime = "nodejs";

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(`availability:${getClientKey(request)}`, 60, 15 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Çok fazla müsaitlik sorgusu yapıldı. Biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  try {
    const input = availabilityQuerySchema.parse({
      checkIn: request.nextUrl.searchParams.get("checkIn"),
      checkOut: request.nextUrl.searchParams.get("checkOut"),
      roomSlug: request.nextUrl.searchParams.get("roomSlug") ?? undefined
    });

    if (input.checkIn < todayDateOnly()) {
      return NextResponse.json({ error: "Giriş tarihi bugünden önce olamaz." }, { status: 400 });
    }

    const [content, reservations] = await Promise.all([getSiteContent(), listReservationRequests()]);
    const hotelCenter = await getHotelCenterData(content);
    const rooms = input.roomSlug ? content.rooms.filter((room) => room.slug === input.roomSlug) : content.rooms;

    if (rooms.length === 0) {
      return NextResponse.json({ error: "Seçilen oda bulunamadı." }, { status: 404 });
    }

    const availability = rooms.map((room) => {
      const item = getHotelCenterStayAvailability(room, reservations, input.checkIn, input.checkOut, hotelCenter);

      return {
        ...item,
        priceLabel: formatBookingCurrency(item.pricePerNight, item.currency),
        totalLabel: formatBookingCurrency(item.estimatedTotal, item.currency)
      };
    });

    return NextResponse.json({
      ok: true,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      rooms: availability
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Müsaitlik bilgisi geçersiz." }, { status: 400 });
    }

    console.error("availability_lookup_failed", error);
    return NextResponse.json({ error: "Müsaitlik bilgisi alınamadı." }, { status: 500 });
  }
}
