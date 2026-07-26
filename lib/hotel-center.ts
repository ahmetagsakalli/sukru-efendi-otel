import { unstable_noStore as noStore } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";
import {
  BOOKING_CURRENCY,
  calculateNights,
  formatBookingCurrency,
  getRoomAvailability,
  parseDateOnly,
  parseRoomPrice
} from "@/lib/booking";
import {
  HotelCenterData,
  HotelCenterRate,
  hotelCenterDataSchema
} from "@/lib/hotel-center-schema";
import type { ReservationRequest } from "@/lib/reservation-schema";
import type { Room, SiteContent } from "@/lib/site-content-schema";
import { isBlobStorageEnabled, readBlobText, writeBlobText } from "@/lib/storage";

type StayPricing = {
  currency: typeof BOOKING_CURRENCY;
  estimatedTotal: number;
  nights: number;
  pricePerNight: number;
};

export type HotelCenterRateRow = {
  availableRooms: number;
  closed: boolean;
  currency: typeof BOOKING_CURRENCY;
  date: string;
  hotelId: string;
  landingUrl: string;
  minNights: number;
  priceLabel: string;
  pricePerNight: number;
  roomSlug: string;
  roomTitle: string;
  totalRooms: number;
};

const contentDirectory = process.env.SITE_CONTENT_DIR
  ? path.resolve(process.env.SITE_CONTENT_DIR)
  : path.join(process.cwd(), "content");

const hotelCenterFilePath = process.env.HOTEL_CENTER_FILE
  ? path.resolve(process.env.HOTEL_CENTER_FILE)
  : path.join(contentDirectory, "google-hotel-center.json");

const hotelCenterBackupDirectory = path.join(contentDirectory, "hotel-center-backups");
const hotelCenterBlobPath = process.env.HOTEL_CENTER_BLOB_PATH ?? "content/google-hotel-center.json";
const hotelCenterBackupBlobDirectory = process.env.HOTEL_CENTER_BACKUP_BLOB_DIR ?? "content/hotel-center-backups";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function dateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addHotelCenterDays(dateValue: string, days: number) {
  const date = parseDateOnly(dateValue);

  if (!date) return "";

  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

export function getHotelCenterToday() {
  return dateOnly(new Date());
}

function getDatesInRange(checkIn: string, checkOut: string) {
  const nights = calculateNights(checkIn, checkOut);

  if (nights <= 0) {
    return [];
  }

  return Array.from({ length: nights }, (_, index) => addHotelCenterDays(checkIn, index));
}

function getDefaultHotelId(siteName: string) {
  return siteName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "sukru-efendi-otel";
}

export function defaultHotelCenterData(content: SiteContent): HotelCenterData {
  return hotelCenterDataSchema.parse({
    rates: [],
    settings: {
      baseUrl: content.site.canonicalUrl,
      defaultAdults: 2,
      enabled: false,
      hotelId: getDefaultHotelId(content.site.name),
      landingPagePath: "/rezervasyon",
      maxAdvanceDays: 365,
      partnerKey: getDefaultHotelId(content.site.shortName),
      partnerName: `${content.site.shortName} Direct`,
      pointOfSaleId: "direct",
      pricesIncludeTax: true,
      ratePlanCode: "BAR"
    },
    updatedAt: ""
  });
}

function normalizeHotelCenterData(rawData: unknown, content: SiteContent) {
  const fallback = defaultHotelCenterData(content);
  const parsed = hotelCenterDataSchema.parse({
    ...fallback,
    ...(rawData as Record<string, unknown>),
    settings: {
      ...fallback.settings,
      ...((rawData as { settings?: unknown } | null)?.settings as Record<string, unknown> | undefined)
    }
  });
  const roomSlugs = new Set(content.rooms.map((room) => room.slug));
  const uniqueRates = new Map<string, HotelCenterRate>();

  parsed.rates
    .filter((rate) => roomSlugs.has(rate.roomSlug))
    .forEach((rate) => {
      uniqueRates.set(`${rate.date}:${rate.roomSlug}`, {
        ...rate,
        updatedAt: rate.updatedAt || parsed.updatedAt
      });
    });

  return hotelCenterDataSchema.parse({
    ...parsed,
    rates: [...uniqueRates.values()].sort(
      (first, second) => first.date.localeCompare(second.date) || first.roomSlug.localeCompare(second.roomSlug)
    )
  });
}

async function ensureHotelCenterDirectories() {
  await fs.mkdir(contentDirectory, { recursive: true });
  await fs.mkdir(hotelCenterBackupDirectory, { recursive: true });
}

async function readHotelCenterFile(content: SiteContent): Promise<HotelCenterData | null> {
  if (isBlobStorageEnabled()) {
    const blobJson = await readBlobText(hotelCenterBlobPath);

    if (blobJson) {
      return normalizeHotelCenterData(JSON.parse(blobJson), content);
    }
  }

  try {
    const json = await fs.readFile(hotelCenterFilePath, "utf8");
    return normalizeHotelCenterData(JSON.parse(json), content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function getHotelCenterData(content: SiteContent) {
  noStore();
  return (await readHotelCenterFile(content)) ?? defaultHotelCenterData(content);
}

export async function saveHotelCenterData(rawData: unknown, content: SiteContent) {
  const now = new Date().toISOString();
  const parsed = normalizeHotelCenterData(
    {
      ...(rawData as Record<string, unknown>),
      settings: {
        ...((rawData as { settings?: unknown } | null)?.settings as Record<string, unknown> | undefined),
        updatedAt: now
      },
      updatedAt: now
    },
    content
  );
  const previous = (await readHotelCenterFile(content)) ?? defaultHotelCenterData(content);

  if (isBlobStorageEnabled()) {
    await writeBlobText(
      `${hotelCenterBackupBlobDirectory}/google-hotel-center-${timestamp()}.json`,
      `${JSON.stringify(previous, null, 2)}\n`
    );
    await writeBlobText(hotelCenterBlobPath, `${JSON.stringify(parsed, null, 2)}\n`);
    return parsed;
  }

  await ensureHotelCenterDirectories();
  await fs.writeFile(
    path.join(hotelCenterBackupDirectory, `google-hotel-center-${timestamp()}.json`),
    `${JSON.stringify(previous, null, 2)}\n`,
    "utf8"
  );

  const temporaryPath = `${hotelCenterFilePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, hotelCenterFilePath);
  return parsed;
}

function getRate(data: HotelCenterData, date: string, roomSlug: string) {
  return data.rates.find((rate) => rate.date === date && rate.roomSlug === roomSlug) ?? null;
}

function getDailyPrice(room: Room, date: string, data: HotelCenterData) {
  const rate = getRate(data, date, room.slug);
  return Math.max(0, rate?.pricePerNight ?? parseRoomPrice(room.price));
}

const dataFallbackCapacity = 2;

function getRoomCapacityNumber(room: Room) {
  const [match] = room.capacity.match(/\d+/) ?? [];
  return Math.max(1, Math.min(Number(match) || dataFallbackCapacity, 20));
}

export function getHotelCenterStayPricing(room: Room, checkIn: string, checkOut: string, data: HotelCenterData): StayPricing {
  const dates = getDatesInRange(checkIn, checkOut);
  const estimatedTotal = dates.reduce((sum, date) => sum + getDailyPrice(room, date, data), 0);
  const nights = dates.length;

  return {
    currency: BOOKING_CURRENCY,
    estimatedTotal,
    nights,
    pricePerNight: nights > 0 ? Math.round(estimatedTotal / nights) : parseRoomPrice(room.price)
  };
}

export function getHotelCenterStayAvailability(
  room: Room,
  reservations: ReservationRequest[],
  checkIn: string,
  checkOut: string,
  data: HotelCenterData,
  excludeReservationId?: string
) {
  const dates = getDatesInRange(checkIn, checkOut);
  const pricing = getHotelCenterStayPricing(room, checkIn, checkOut, data);

  if (dates.length === 0) {
    const fallback = getRoomAvailability(room, reservations, checkIn, checkOut, excludeReservationId);
    return {
      ...fallback,
      ...pricing,
      isAvailable: false,
      minNights: 1
    };
  }

  let availableRooms = room.count;
  let closed = false;
  let minNights = 1;

  dates.forEach((date) => {
    const rate = getRate(data, date, room.slug);
    const nightlyAvailability = getRoomAvailability(
      room,
      reservations,
      date,
      addHotelCenterDays(date, 1),
      excludeReservationId
    );

    if (rate?.closed) {
      closed = true;
    }

    minNights = Math.max(minNights, rate?.minNights ?? 1);
    availableRooms = Math.min(availableRooms, nightlyAvailability.availableRooms, rate?.availableRooms ?? room.count);
  });

  return {
    ...getRoomAvailability(room, reservations, checkIn, checkOut, excludeReservationId),
    ...pricing,
    availableRooms,
    isAvailable: pricing.nights >= minNights && pricing.pricePerNight > 0 && !closed && availableRooms > 0,
    minNights
  };
}

export function buildHotelCenterLandingUrl(
  data: HotelCenterData,
  roomSlug: string,
  checkIn = "{checkIn}",
  checkOut = "{checkOut}",
  adults: number | string = data.settings.defaultAdults
) {
  const baseUrl = data.settings.baseUrl.replace(/\/$/, "");
  const path = data.settings.landingPagePath.startsWith("/")
    ? data.settings.landingPagePath
    : `/${data.settings.landingPagePath}`;
  const query = new URLSearchParams({
    adults: String(adults),
    checkIn,
    checkOut,
    room: roomSlug
  });

  return `${baseUrl}${path}?${query.toString()}`;
}

export function buildHotelCenterRateRows({
  content,
  data,
  from,
  reservations,
  to
}: {
  content: SiteContent;
  data: HotelCenterData;
  from: string;
  reservations: ReservationRequest[];
  to: string;
}): HotelCenterRateRow[] {
  const dates = getDatesInRange(from, to);

  return dates.flatMap((date) =>
    content.rooms.map((room) => {
      const rate = getRate(data, date, room.slug);
      const availability = getHotelCenterStayAvailability(
        room,
        reservations,
        date,
        addHotelCenterDays(date, 1),
        data
      );
      const closed = Boolean(rate?.closed || !availability.isAvailable);

      return {
        availableRooms: closed ? 0 : availability.availableRooms,
        closed,
        currency: BOOKING_CURRENCY,
        date,
        hotelId: data.settings.hotelId,
        landingUrl: buildHotelCenterLandingUrl(
          data,
          room.slug,
          date,
          addHotelCenterDays(date, Math.max(rate?.minNights ?? 1, 1))
        ),
        minNights: rate?.minNights ?? 1,
        priceLabel: formatBookingCurrency(availability.pricePerNight, BOOKING_CURRENCY),
        pricePerNight: availability.pricePerNight,
        roomSlug: room.slug,
        roomTitle: room.title,
        totalRooms: room.count
      };
    })
  );
}

function escapeXml(value: string | number | boolean) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildHotelCenterRatesXml(data: HotelCenterData, rows: HotelCenterRateRow[]) {
  const amountAttribute = data.settings.pricesIncludeTax ? "AmountAfterTax" : "AmountBeforeTax";
  const messages = rows
    .map(
      (row) => `    <RateAmountMessage>
      <StatusApplicationControl Start="${escapeXml(row.date)}" End="${escapeXml(row.date)}" InvTypeCode="${escapeXml(row.roomSlug)}" RatePlanCode="${escapeXml(data.settings.ratePlanCode)}" />
      <Rates>
        <Rate>
          <BaseByGuestAmts>
            <BaseByGuestAmt ${amountAttribute}="${escapeXml(row.pricePerNight)}" CurrencyCode="${escapeXml(row.currency)}" NumberOfGuests="${escapeXml(data.settings.defaultAdults)}" />
          </BaseByGuestAmts>
        </Rate>
      </Rates>
    </RateAmountMessage>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<OTA_HotelRateAmountNotifRQ xmlns="http://www.opentravel.org/OTA/2003/05" TimeStamp="${escapeXml(new Date().toISOString())}" Version="3.0">
  <RateAmountMessages HotelCode="${escapeXml(data.settings.hotelId)}">
${messages}
  </RateAmountMessages>
</OTA_HotelRateAmountNotifRQ>
`;
}

export function buildHotelCenterInventoryXml(data: HotelCenterData, rows: HotelCenterRateRow[]) {
  const messages = rows
    .map(
      (row) => `    <AvailStatusMessage BookingLimit="${escapeXml(row.availableRooms)}">
      <StatusApplicationControl Start="${escapeXml(row.date)}" End="${escapeXml(row.date)}" InvTypeCode="${escapeXml(row.roomSlug)}" RatePlanCode="${escapeXml(data.settings.ratePlanCode)}" />
      <RestrictionStatus Status="${row.closed ? "Close" : "Open"}" />
      <LengthsOfStay>
        <LengthOfStay Time="${escapeXml(row.minNights)}" TimeUnit="Day" MinMaxMessageType="SetMinLOS" />
      </LengthsOfStay>
    </AvailStatusMessage>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<OTA_HotelAvailNotifRQ xmlns="http://www.opentravel.org/OTA/2003/05" TimeStamp="${escapeXml(new Date().toISOString())}" Version="3.0">
  <AvailStatusMessages HotelCode="${escapeXml(data.settings.hotelId)}">
${messages}
  </AvailStatusMessages>
</OTA_HotelAvailNotifRQ>
`;
}

export function buildHotelCenterHotelListXml(content: SiteContent, data: HotelCenterData) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<listings>
  <language>tr</language>
  <listing>
    <id>${escapeXml(data.settings.hotelId)}</id>
    <name>${escapeXml(content.site.name)}</name>
    <address format="simple">
      <component name="addr1">${escapeXml(content.site.address)}</component>
      <component name="city">Altınordu</component>
      <component name="province">Ordu</component>
      <component name="postal_code">52200</component>
    </address>
    <country>TR</country>
    <phone type="main">${escapeXml(content.site.phone)}</phone>
    <content>
      <text type="description">
        <link>${escapeXml(content.site.canonicalUrl)}</link>
        <title>${escapeXml(content.site.name)}</title>
        <body>${escapeXml(content.site.description)}</body>
      </text>
    </content>
  </listing>
</listings>
`;
}

export function buildHotelCenterPropertyDataXml(content: SiteContent, data: HotelCenterData) {
  const roomData = content.rooms
    .map((room) => {
      const capacity = getRoomCapacityNumber(room);

      return `    <RoomData>
      <RoomID>${escapeXml(room.slug)}</RoomID>
      <Name>
        <Text text="${escapeXml(room.title)}" language="tr" />
      </Name>
      <Description>
        <Text text="${escapeXml(room.description)}" language="tr" />
      </Description>
      <Capacity>${escapeXml(capacity)}</Capacity>
      <AdultCapacity>${escapeXml(capacity)}</AdultCapacity>
      <AllowablePackageIDs>
        <PackageID>${escapeXml(data.settings.ratePlanCode)}</PackageID>
      </AllowablePackageIDs>
    </RoomData>`;
    })
    .join("\n");
  const allowableRooms = content.rooms
    .map((room) => `        <RoomID>${escapeXml(room.slug)}</RoomID>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Transaction timestamp="${escapeXml(new Date().toISOString())}" id="${escapeXml(`property-${Date.now()}`)}" partner="${escapeXml(data.settings.partnerKey)}">
  <PropertyDataSet action="overlay">
    <Property>${escapeXml(data.settings.hotelId)}</Property>
${roomData}
    <PackageData>
      <PackageID>${escapeXml(data.settings.ratePlanCode)}</PackageID>
      <Name>
        <Text text="Standart fiyat" language="tr" />
      </Name>
      <Description>
        <Text text="Doğrudan rezervasyon fiyat planı" language="tr" />
      </Description>
      <AllowableRoomIDs>
${allowableRooms}
      </AllowableRoomIDs>
    </PackageData>
  </PropertyDataSet>
</Transaction>
`;
}

export function buildHotelCenterLandingPagesXml(content: SiteContent, data: HotelCenterData) {
  const url = `${data.settings.baseUrl.replace(/\/$/, "")}${data.settings.landingPagePath}?room=(PARTNER-ROOM-ID)&checkIn=(CHECKINDAY)&checkOut=(CHECKOUTDAY)&adults=(NUM-ADULTS)`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<PointsOfSale>
  <PointOfSale id="${escapeXml(data.settings.pointOfSaleId)}">
    <DisplayNames display_text="${escapeXml(content.site.shortName)}" display_language="tr" />
    <Match status="yes" country="TR" language="tr" />
    <URL>${escapeXml(url)}</URL>
  </PointOfSale>
</PointsOfSale>
`;
}
