import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasAdminSession } from "@/lib/admin-auth";
import {
  createAdminReservation,
  listReservationRequests,
  ReservationConflictError,
  ReservationRoomNotFoundError,
  updateReservationRequest
} from "@/lib/reservations";
import { getSiteContent } from "@/lib/site-content";

export const runtime = "nodejs";

async function requireAdmin() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 });
  }

  return null;
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  return NextResponse.json({ reservations: await listReservationRequests() });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { rooms } = await getSiteContent();
    const reservation = await createAdminReservation(await request.json(), rooms);
    return NextResponse.json({ ok: true, reservation });
  } catch (error) {
    if (error instanceof ReservationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof ReservationRoomNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Geçersiz rezervasyon bilgisi." }, { status: 400 });
    }

    console.error("admin_reservation_create_failed", error);
    return NextResponse.json({ error: "Rezervasyon oluşturulamadı." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { rooms } = await getSiteContent();
    const reservation = await updateReservationRequest(await request.json(), rooms);

    if (!reservation) {
      return NextResponse.json({ error: "Rezervasyon talebi bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, reservation });
  } catch (error) {
    if (error instanceof ReservationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof ReservationRoomNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Geçersiz rezervasyon güncellemesi." }, { status: 400 });
    }

    console.error("admin_reservation_update_failed", error);
    return NextResponse.json({ error: "Rezervasyon güncellenemedi." }, { status: 500 });
  }
}
