import { unstable_noStore as noStore } from "next/cache";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { BOOKING_CURRENCY, calculateNights, getRoomAvailability, getStayPricing, validateRoomOccupancy } from "@/lib/booking";
import { getInitialPaymentFields, isPaymentCollectionEnabled } from "@/lib/payments";
import type { Room } from "@/lib/site-content-schema";
import { isBlobStorageEnabled, readBlobText, writeBlobText } from "@/lib/storage";
import {
  AdminCreateReservationInput,
  adminCreateReservationSchema,
  CreateReservationRequestInput,
  ReservationRequest,
  reservationRequestSchema,
  updateReservationRequestSchema
} from "@/lib/reservation-schema";

type ReservationPaymentPatch = Partial<
  Pick<
    ReservationRequest,
    | "adminNote"
    | "paidAt"
    | "paymentAmount"
    | "paymentCurrency"
    | "paymentFailureReason"
    | "paymentProvider"
    | "paymentRedirectUrl"
    | "paymentReference"
    | "paymentStartedAt"
    | "paymentStatus"
    | "paymentUpdatedAt"
    | "status"
  >
>;

type ReservationPricingPatch = Pick<ReservationRequest, "currency" | "estimatedTotal" | "nights" | "pricePerNight">;
type ReservationAvailabilityGuard = (items: ReservationRequest[]) => {
  isAvailable: boolean;
  message?: string;
};

const contentDirectory = process.env.SITE_CONTENT_DIR
  ? path.resolve(process.env.SITE_CONTENT_DIR)
  : path.join(process.cwd(), "content");

const reservationFilePath = process.env.RESERVATION_REQUESTS_FILE
  ? path.resolve(process.env.RESERVATION_REQUESTS_FILE)
  : path.join(contentDirectory, "reservation-requests.json");

const reservationBackupDirectory = path.join(contentDirectory, "reservation-backups");
const reservationBlobPath = process.env.RESERVATION_REQUESTS_BLOB_PATH ?? "content/reservation-requests.json";
const reservationBackupBlobDirectory =
  process.env.RESERVATION_BACKUP_BLOB_DIR ?? "content/reservation-backups";
let reservationMutationQueue: Promise<void> = Promise.resolve();

export class ReservationConflictError extends Error {
  constructor(message = "Seçilen tarih aralığında bu oda için müsaitlik yok.") {
    super(message);
    this.name = "ReservationConflictError";
  }
}

export class ReservationRoomNotFoundError extends Error {
  constructor(message = "Seçilen oda bulunamadı.") {
    super(message);
    this.name = "ReservationRoomNotFoundError";
  }
}

export class ReservationOccupancyError extends Error {
  constructor(message = "Misafir sayısı oda kapasitesini aşıyor.") {
    super(message);
    this.name = "ReservationOccupancyError";
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function withReservationMutation<T>(operation: () => Promise<T>) {
  const previousMutation = reservationMutationQueue.catch(() => undefined);
  let releaseQueue: () => void = () => undefined;
  reservationMutationQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previousMutation;

  try {
    return await operation();
  } finally {
    releaseQueue();
  }
}

async function ensureReservationDirectory() {
  await fs.mkdir(contentDirectory, { recursive: true });
  await fs.mkdir(reservationBackupDirectory, { recursive: true });
}

async function readReservationFile(): Promise<ReservationRequest[]> {
  if (isBlobStorageEnabled()) {
    const blobJson = await readBlobText(reservationBlobPath);

    if (blobJson) {
      return reservationRequestSchema.array().parse(JSON.parse(blobJson));
    }
  }

  try {
    const raw = await fs.readFile(reservationFilePath, "utf8");
    return reservationRequestSchema.array().parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeReservationFile(items: ReservationRequest[]) {
  const previous = await readReservationFile();

  if (isBlobStorageEnabled()) {
    await writeBlobText(
      `${reservationBackupBlobDirectory}/reservation-requests-${timestamp()}.json`,
      `${JSON.stringify(previous, null, 2)}\n`
    );
    await writeBlobText(reservationBlobPath, `${JSON.stringify(items, null, 2)}\n`);
    return;
  }

  await ensureReservationDirectory();

  await fs.writeFile(
    path.join(reservationBackupDirectory, `reservation-requests-${timestamp()}.json`),
    `${JSON.stringify(previous, null, 2)}\n`,
    "utf8"
  );

  const temporaryPath = `${reservationFilePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, reservationFilePath);
}

export function getReservationFilePath() {
  return reservationFilePath;
}

export async function listReservationRequests() {
  noStore();
  const items = await readReservationFile();
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function findRoom(rooms: Room[], roomSlug: string) {
  return rooms.find((room) => room.slug === roomSlug) ?? null;
}

function ensureCanBlockRoom({
  checkIn,
  checkOut,
  excludeReservationId,
  items,
  room
}: {
  checkIn: string;
  checkOut: string;
  excludeReservationId?: string;
  items: ReservationRequest[];
  room: Room;
}) {
  const availability = getRoomAvailability(room, items, checkIn, checkOut, excludeReservationId);

  if (!availability.isAvailable) {
    throw new ReservationConflictError();
  }
}

function ensureRoomOccupancy(room: Room, adults: number, children: number) {
  const occupancy = validateRoomOccupancy(room, adults, children);

  if (!occupancy.isValid) {
    throw new ReservationOccupancyError(occupancy.message);
  }
}

function getWebsiteReservationStatus(): ReservationRequest["status"] {
  if (isPaymentCollectionEnabled()) {
    return "new";
  }

  const mode = process.env.WEBSITE_RESERVATION_MODE?.trim().toLocaleLowerCase("en-US");
  return mode === "manual" || mode === "request" ? "new" : "confirmed";
}

function getWebsitePaymentFields(now: string): ReservationPaymentPatch {
  const payment = getInitialPaymentFields();

  if (!isPaymentCollectionEnabled()) {
    return payment;
  }

  return {
    ...payment,
    paymentStartedAt: now,
    paymentStatus: "processing"
  };
}

function buildReservationRecord({
  id,
  createdAt,
  input,
  payment,
  pricing: customPricing,
  room,
  source,
  status,
  updatedAt
}: {
  id: string;
  createdAt: string;
  input: AdminCreateReservationInput | CreateReservationRequestInput;
  payment?: ReservationPaymentPatch;
  pricing?: ReservationPricingPatch;
  room: Room;
  source: "admin" | "website";
  status: ReservationRequest["status"];
  updatedAt: string;
}) {
  ensureRoomOccupancy(room, input.adults, input.children);
  const hasAdminPrice = "pricePerNight" in input && typeof input.pricePerNight === "number";
  const nights = calculateNights(input.checkIn, input.checkOut);
  const pricePerNight = hasAdminPrice ? Math.max(0, Math.round(input.pricePerNight ?? 0)) : 0;
  const pricing = hasAdminPrice
    ? {
        currency: BOOKING_CURRENCY,
        estimatedTotal: nights * pricePerNight,
        nights,
        pricePerNight
      }
    : customPricing ?? getStayPricing(room, input.checkIn, input.checkOut);

  return reservationRequestSchema.parse({
    id,
    createdAt,
    updatedAt,
    status,
    source,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    roomSlug: room.slug,
    roomTitle: room.title,
    adults: input.adults,
    children: input.children,
    name: input.name,
    phone: input.phone,
    email: input.email ?? "",
    note: input.note ?? "",
    adminNote: "adminNote" in input ? input.adminNote ?? "" : "",
    ...payment,
    ...pricing
  });
}

export async function createReservationRequest(
  input: CreateReservationRequestInput,
  room: Room,
  pricing?: ReservationPricingPatch,
  availabilityGuard?: ReservationAvailabilityGuard
) {
  return withReservationMutation(async () => {
    const now = new Date().toISOString();

    const items = await readReservationFile();
    const guardedAvailability = availabilityGuard?.(items);

    if (guardedAvailability && !guardedAvailability.isAvailable) {
      throw new ReservationConflictError(guardedAvailability.message);
    }

    ensureCanBlockRoom({
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      items,
      room
    });

    const item = buildReservationRecord({
      id: crypto.randomUUID(),
      createdAt: now,
      input,
      payment: getWebsitePaymentFields(now),
      pricing,
      room,
      source: "website",
      status: getWebsiteReservationStatus(),
      updatedAt: now
    });

    await writeReservationFile([item, ...items]);
    return item;
  });
}

export async function createAdminReservation(rawInput: unknown, rooms: Room[]) {
  return withReservationMutation(async () => {
    const input = adminCreateReservationSchema.parse(rawInput);
    const room = findRoom(rooms, input.roomSlug);

    if (!room) {
      throw new ReservationRoomNotFoundError();
    }

    const items = await readReservationFile();

    if (input.status === "confirmed") {
      ensureCanBlockRoom({
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        items,
        room
      });
    }

    const now = new Date().toISOString();
    const item = buildReservationRecord({
      id: crypto.randomUUID(),
      createdAt: now,
      input,
      room,
      source: "admin",
      status: input.status,
      updatedAt: now
    });

    await writeReservationFile([item, ...items]);
    return item;
  });
}

export async function updateReservationRequest(rawInput: unknown, rooms: Room[]) {
  return withReservationMutation(async () => {
    const input = updateReservationRequestSchema.parse(rawInput);
    const now = new Date().toISOString();
    const items = await readReservationFile();
    const index = items.findIndex((item) => item.id === input.id);

    if (index === -1) {
      return null;
    }

    const room = findRoom(rooms, input.roomSlug);

    if (!room) {
      throw new ReservationRoomNotFoundError();
    }

    if (input.status === "confirmed") {
      ensureCanBlockRoom({
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        excludeReservationId: input.id,
        items,
        room
      });
    }

    const updated = buildReservationRecord({
      id: items[index].id,
      createdAt: items[index].createdAt,
      input,
      payment: {
        paidAt: items[index].paidAt,
        paymentAmount: items[index].paymentAmount,
        paymentCurrency: items[index].paymentCurrency,
        paymentFailureReason: items[index].paymentFailureReason,
        paymentProvider: items[index].paymentProvider,
        paymentRedirectUrl: items[index].paymentRedirectUrl,
        paymentReference: items[index].paymentReference,
        paymentStartedAt: items[index].paymentStartedAt,
        paymentStatus: items[index].paymentStatus,
        paymentUpdatedAt: items[index].paymentUpdatedAt
      },
      room,
      source: items[index].source,
      status: input.status,
      updatedAt: now
    });

    const next = items.map((item, currentIndex) => (currentIndex === index ? updated : item));
    await writeReservationFile(next);
    return updated;
  });
}

export async function getReservationRequestById(id: string) {
  noStore();
  const items = await readReservationFile();
  return items.find((item) => item.id === id) ?? null;
}

export async function updateReservationPaymentState(id: string, patch: ReservationPaymentPatch) {
  return withReservationMutation(async () => {
    const now = new Date().toISOString();
    const items = await readReservationFile();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    const updated = reservationRequestSchema.parse({
      ...items[index],
      ...patch,
      paymentUpdatedAt: now,
      updatedAt: now
    });
    const next = items.map((item, currentIndex) => (currentIndex === index ? updated : item));
    await writeReservationFile(next);
    return updated;
  });
}

function appendAdminNote(existingNote: string, note: string) {
  return [existingNote, note].filter(Boolean).join("\n");
}

export async function settleReservationPaymentByReference({
  amount,
  failureReason,
  isSuccessful,
  provider,
  reference,
  rooms
}: {
  amount: number;
  failureReason?: string;
  isSuccessful: boolean;
  provider: ReservationRequest["paymentProvider"];
  reference: string;
  rooms: Room[];
}) {
  return withReservationMutation(async () => {
    const now = new Date().toISOString();
    const items = await readReservationFile();
    const index = items.findIndex((item) => item.paymentReference === reference);

    if (index === -1) {
      return null;
    }

    const current = items[index];

    if (current.paymentStatus === "paid" && isSuccessful) {
      return current;
    }

    let patch: ReservationPaymentPatch;

    if (isSuccessful && amount >= current.paymentAmount) {
      const room = rooms.find((item) => item.slug === current.roomSlug);
      const availability = room
        ? getRoomAvailability(room, items, current.checkIn, current.checkOut, current.id)
        : null;
      const canConfirm = Boolean(room && availability?.isAvailable);

      patch = {
        paidAt: current.paidAt || now,
        paymentAmount: amount,
        paymentCurrency: "TRY",
        paymentFailureReason: "",
        paymentProvider: provider,
        paymentStatus: "paid",
        paymentUpdatedAt: now,
        status: canConfirm ? "confirmed" : "contacted"
      };

      if (!canConfirm) {
        patch.adminNote = appendAdminNote(
          current.adminNote,
          "Ödeme alındı ancak müsaitlik otomatik onay için uygun değildi. Manuel kontrol ve gerekirse iade gerekiyor."
        );
      }
    } else {
      patch = {
        paymentFailureReason:
          failureReason || (isSuccessful ? "Ödeme tutarı beklenen tutardan düşük geldi." : "Ödeme başarısız."),
        paymentProvider: provider,
        paymentStatus: "failed",
        paymentUpdatedAt: now,
        status: current.status === "confirmed" ? "contacted" : "cancelled"
      };
    }

    const updated = reservationRequestSchema.parse({
      ...current,
      ...patch,
      updatedAt: now
    });
    const next = items.map((item, currentIndex) => (currentIndex === index ? updated : item));
    await writeReservationFile(next);
    return updated;
  });
}
