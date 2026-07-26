import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasAdminSession } from "@/lib/admin-auth";
import { getHotelCenterData, saveHotelCenterData } from "@/lib/hotel-center";
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

  const content = await getSiteContent();
  return NextResponse.json({ hotelCenter: await getHotelCenterData(content) });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const content = await getSiteContent();
    const hotelCenter = await saveHotelCenterData(await request.json(), content);
    return NextResponse.json({ ok: true, hotelCenter });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Google Hotel Center ayarları geçersiz.",
          issues: error.issues.map((issue) => ({
            message: issue.message,
            path: issue.path.join(".")
          }))
        },
        { status: 400 }
      );
    }

    console.error("admin_hotel_center_save_failed", error);
    return NextResponse.json({ error: "Google Hotel Center ayarları kaydedilemedi." }, { status: 500 });
  }
}
