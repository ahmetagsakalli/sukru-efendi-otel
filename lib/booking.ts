import type { ReservationRequest, ReservationStatus } from "@/lib/reservation-schema";
import type { Room } from "@/lib/site-content-schema";

export const BOOKING_CURRENCY = "TRY";

const blockingStatuses = new Set<ReservationStatus>(["confirmed"]);

function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDateOnly() {
  return dateOnly(new Date());
}

export function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date;
}

export function calculateNights(checkIn: string, checkOut: string) {
  const checkInDate = parseDateOnly(checkIn);
  const checkOutDate = parseDateOnly(checkOut);

  if (!checkInDate || !checkOutDate) {
    return 0;
  }

  return Math.max(0, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000));
}

export function parseRoomPrice(price: string) {
  const compact = price.replace(/\s/g, "");
  const sanitized = compact.replace(/[^\d,.-]/g, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(sanitized)
      ? sanitized.replace(/\./g, "")
      : sanitized;
  const value = Number(normalized);

  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.round(value);
}

export function formatBookingCurrency(amount: number, currency = BOOKING_CURRENCY) {
  return new Intl.NumberFormat("tr-TR", {
    currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(amount);
}

export function getRoomCapacityLimit(room: Pick<Room, "capacity">) {
  const numbers = room.capacity
    .match(/\d+/g)
    ?.map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);

  return numbers?.length ? Math.max(...numbers) : 1;
}

export function getGuestCount(adults: number, children: number) {
  return Math.max(0, adults) + Math.max(0, children);
}

export function validateRoomOccupancy(room: Pick<Room, "capacity" | "title">, adults: number, children: number) {
  const capacityLimit = getRoomCapacityLimit(room);
  const guestCount = getGuestCount(adults, children);

  return {
    capacityLimit,
    guestCount,
    isValid: guestCount > 0 && guestCount <= capacityLimit,
    message:
      guestCount > capacityLimit
        ? `${room.title} için en fazla ${capacityLimit} misafir seçilebilir.`
        : "En az 1 misafir seçilmeli."
  };
}

export function rangesOverlap(firstCheckIn: string, firstCheckOut: string, secondCheckIn: string, secondCheckOut: string) {
  const firstStart = parseDateOnly(firstCheckIn);
  const firstEnd = parseDateOnly(firstCheckOut);
  const secondStart = parseDateOnly(secondCheckIn);
  const secondEnd = parseDateOnly(secondCheckOut);

  if (!firstStart || !firstEnd || !secondStart || !secondEnd) {
    return false;
  }

  return firstStart.getTime() < secondEnd.getTime() && secondStart.getTime() < firstEnd.getTime();
}

export function isReservationBlocking(status: ReservationStatus) {
  return blockingStatuses.has(status);
}

export function getStayPricing(room: Room, checkIn: string, checkOut: string) {
  const nights = calculateNights(checkIn, checkOut);
  const pricePerNight = parseRoomPrice(room.price);
  const estimatedTotal = nights * pricePerNight;

  return {
    currency: BOOKING_CURRENCY,
    estimatedTotal,
    nights,
    pricePerNight
  };
}

export function getRoomAvailability(
  room: Room,
  reservations: ReservationRequest[],
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string
) {
  const bookedRooms = reservations.filter((reservation) => {
    if (reservation.id === excludeReservationId) return false;
    if (reservation.roomSlug !== room.slug) return false;
    if (!isReservationBlocking(reservation.status)) return false;
    return rangesOverlap(checkIn, checkOut, reservation.checkIn, reservation.checkOut);
  }).length;
  const availableRooms = Math.max(room.count - bookedRooms, 0);
  const capacityLimit = getRoomCapacityLimit(room);
  const pricing = getStayPricing(room, checkIn, checkOut);

  return {
    ...pricing,
    availableRooms,
    bookedRooms,
    capacityLimit,
    isAvailable: pricing.nights > 0 && room.count > 0 && availableRooms > 0,
    roomSlug: room.slug,
    roomTitle: room.title,
    totalRooms: room.count
  };
}
