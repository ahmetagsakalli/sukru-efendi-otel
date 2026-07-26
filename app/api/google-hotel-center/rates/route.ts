import { NextRequest, NextResponse } from "next/server";
import {
  addHotelCenterDays,
  buildHotelCenterInventoryXml,
  buildHotelCenterRateRows,
  buildHotelCenterRatesXml,
  getHotelCenterData,
  getHotelCenterToday
} from "@/lib/hotel-center";
import { requireHotelCenterFeedAccess } from "@/lib/hotel-center-feed-auth";
import { listReservationRequests } from "@/lib/reservations";
import { getSiteContent } from "@/lib/site-content";

export const runtime = "nodejs";

function getRange(request: NextRequest, maxAdvanceDays: number) {
  const from = request.nextUrl.searchParams.get("from") ?? getHotelCenterToday();
  const days = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("days") ?? 60), maxAdvanceDays, 365));
  const to = request.nextUrl.searchParams.get("to") ?? addHotelCenterDays(from, days);

  return { from, to };
}

export async function GET(request: NextRequest) {
  const unauthorized = requireHotelCenterFeedAccess(request);
  if (unauthorized) return unauthorized;

  const [content, reservations] = await Promise.all([getSiteContent(), listReservationRequests()]);
  const hotelCenter = await getHotelCenterData(content);
  const { from, to } = getRange(request, hotelCenter.settings.maxAdvanceDays);
  const rows = buildHotelCenterRateRows({
    content,
    data: hotelCenter,
    from,
    reservations,
    to
  });
  const format = request.nextUrl.searchParams.get("format") ?? "json";

  if (format === "rates-xml") {
    return new NextResponse(buildHotelCenterRatesXml(hotelCenter, rows), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/xml; charset=utf-8"
      }
    });
  }

  if (format === "inventory-xml") {
    return new NextResponse(buildHotelCenterInventoryXml(hotelCenter, rows), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/xml; charset=utf-8"
      }
    });
  }

  return NextResponse.json(
    {
      from,
      hotelCenter: {
        enabled: hotelCenter.settings.enabled,
        hotelId: hotelCenter.settings.hotelId,
        landingPagePath: hotelCenter.settings.landingPagePath,
        partnerKey: hotelCenter.settings.partnerKey,
        partnerName: hotelCenter.settings.partnerName,
        pointOfSaleId: hotelCenter.settings.pointOfSaleId,
        pricesIncludeTax: hotelCenter.settings.pricesIncludeTax,
        ratePlanCode: hotelCenter.settings.ratePlanCode
      },
      ok: true,
      rows,
      to,
      updatedAt: hotelCenter.updatedAt
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
