import { NextRequest, NextResponse } from "next/server";
import { buildHotelCenterHotelListXml, getHotelCenterData } from "@/lib/hotel-center";
import { requireHotelCenterFeedAccess } from "@/lib/hotel-center-feed-auth";
import { getSiteContent } from "@/lib/site-content";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = requireHotelCenterFeedAccess(request);
  if (unauthorized) return unauthorized;

  const content = await getSiteContent();
  const hotelCenter = await getHotelCenterData(content);

  return new NextResponse(buildHotelCenterHotelListXml(content, hotelCenter), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}
