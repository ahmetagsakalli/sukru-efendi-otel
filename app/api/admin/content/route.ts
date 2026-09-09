import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasAdminSession } from "@/lib/admin-auth";
import {
  getSiteContent,
  listPublicImages,
  saveSiteContent,
} from "@/lib/site-content";
import { siteContentSchema } from "@/lib/site-content-schema";
import { listReservationRequests } from "@/lib/reservations";

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

  const [content, images] = await Promise.all([
    getSiteContent(),
    listPublicImages(),
  ]);
  return NextResponse.json({ content, images });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const input = siteContentSchema.parse(await request.json());
    const [previous, reservations] = await Promise.all([
      getSiteContent(),
      listReservationRequests(),
    ]);
    const retainedSlugs = new Set(input.rooms.map((room) => room.slug));
    const removed = previous.rooms.filter(
      (room) => !retainedSlugs.has(room.slug),
    );
    if (
      removed.some((room) =>
        reservations.some((reservation) => reservation.roomSlug === room.slug),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Rezervasyon kaydı bulunan bir oda silinemez veya sayfa adresi değiştirilemez. Yeni rezervasyonları kapatmak için oda sayısını sıfır yapabilirsiniz.",
        },
        { status: 409 },
      );
    }
    const content = await saveSiteContent(input);
    return NextResponse.json({ ok: true, content });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "İçerikte eksik veya hatalı alan var.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    console.error("admin_content_save_failed", error);
    return NextResponse.json(
      { error: "İçerik kaydedilemedi." },
      { status: 500 },
    );
  }
}
