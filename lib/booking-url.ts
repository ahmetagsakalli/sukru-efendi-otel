import { getRoomCapacityLimit, parseDateOnly, todayDateOnly } from "@/lib/booking";
import { getOriginalRoomSlug, getOriginalRoomSlugFromAnyLocale, type PublicLocale } from "@/lib/i18n";
import type { Room } from "@/lib/site-content-schema";

export type BookingSearchParams = Record<string, string | string[] | undefined>;

export type BookingInitialValues = {
  adults?: string;
  checkIn?: string;
  checkOut?: string;
  children?: string;
  roomSlug?: string;
};

const queryAliases = {
  adults: ["adults", "adult", "adultCount"],
  checkIn: ["checkIn", "checkin", "arrival", "arrivalDate", "startDate"],
  checkOut: ["checkOut", "checkout", "departure", "departureDate", "endDate"],
  children: ["children", "child", "childCount"],
  room: ["room", "roomSlug", "roomType", "room_type"]
} satisfies Record<string, string[]>;

function firstParam(searchParams: BookingSearchParams | undefined, names: string[]) {
  for (const name of names) {
    const value = searchParams?.[name];

    if (Array.isArray(value)) {
      const first = value.find(Boolean);
      if (first) return first;
      continue;
    }

    if (value) return value;
  }

  return "";
}

function normalizeDate(value: string) {
  return parseDateOnly(value) ? value : "";
}

function addDays(dateValue: string, days: number) {
  const date = parseDateOnly(dateValue);

  if (!date) return "";

  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clampNumber(value: string, min: number, max: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return min;
  }

  return Math.min(Math.max(Math.round(numberValue), min), max);
}

function normalizeRoomSlug(value: string, rooms: Room[], locale: PublicLocale) {
  if (!value) return "";

  const originalSlug = getOriginalRoomSlug(value, locale) || getOriginalRoomSlugFromAnyLocale(value);
  return rooms.some((room) => room.slug === originalSlug) ? originalSlug : "";
}

export function getBookingInitialValues(
  searchParams: BookingSearchParams | undefined,
  rooms: Room[],
  locale: PublicLocale
): BookingInitialValues {
  const result: BookingInitialValues = {};
  const roomSlug = normalizeRoomSlug(firstParam(searchParams, queryAliases.room), rooms, locale);
  const selectedRoom = rooms.find((room) => room.slug === roomSlug) ?? rooms[1] ?? rooms[0];

  if (roomSlug) {
    result.roomSlug = roomSlug;
  }

  const checkIn = normalizeDate(firstParam(searchParams, queryAliases.checkIn));
  const checkOut = normalizeDate(firstParam(searchParams, queryAliases.checkOut));
  const today = todayDateOnly();

  if (checkIn && checkIn >= today) {
    result.checkIn = checkIn;
    result.checkOut = checkOut && checkOut > checkIn ? checkOut : addDays(checkIn, 1);
  }

  if (selectedRoom) {
    const capacityLimit = getRoomCapacityLimit(selectedRoom);
    const hasAdultParam = Boolean(firstParam(searchParams, queryAliases.adults));
    const hasChildParam = Boolean(firstParam(searchParams, queryAliases.children));
    const adults = clampNumber(firstParam(searchParams, queryAliases.adults), 1, capacityLimit);
    const children = clampNumber(firstParam(searchParams, queryAliases.children), 0, Math.max(capacityLimit - adults, 0));

    if (hasAdultParam || hasChildParam) {
      result.adults = String(adults);
    }

    if (hasChildParam) {
      result.children = String(children);
    }
  }

  return result;
}
