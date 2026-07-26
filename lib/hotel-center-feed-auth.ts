import { NextRequest, NextResponse } from "next/server";

function getExpectedToken() {
  return process.env.GOOGLE_HOTEL_CENTER_FEED_TOKEN?.trim() ?? "";
}

function getRequestToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return request.nextUrl.searchParams.get("token")?.trim() ?? "";
}

export function requireHotelCenterFeedAccess(request: NextRequest) {
  const expectedToken = getExpectedToken();

  if (!expectedToken) {
    return null;
  }

  if (getRequestToken(request) === expectedToken) {
    return null;
  }

  return NextResponse.json({ error: "Google Hotel Center feed erişimi yetkisiz." }, { status: 401 });
}
