import { unstable_noStore as noStore } from "next/cache";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getRoomAvailability, getStayPricing } from "@/lib/booking";
import type { Room } from "@/lib/site-content-schema";
import {
  AdminCreateReservationInput,
  adminCreateReservationSchema,
  CreateReservationRequestInput,
  ReservationRequest,
  reservationRequestSchema,
  updateReservationRequestSchema
} from "@/lib/reservation-schema";

const contentDirectory = process.env.SITE_CONTENT_DIR
  ? path.resolve(process.env.SITE_CONTENT_DIR)
  : path.join(process.cwd(), "content");

const reservationFilePath = process.env.RESERVATION_REQUESTS_FILE
  ? path.resolve(process.env.RESERVATION_REQUESTS_FILE)
  : path.join(contentDirectory, "reservation-requests.json");

const reservationBackupDirectory = path.join(contentDirectory, "reservation-backups");

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

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function ensureReservationDirectory() {
  await fs.mkdir(contentDirectory, { recursive: true });
  await fs.mkdir(reservationBackupDirectory, { recursive: true });
}

async function readReservationFile(): Promise<ReservationRequest[]> {
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
  await ensureReservationDirectory();

  const previous = await readReservationFile();
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

function buildReservationRecord({
  id,
  createdAt,
  input,
  room,
  source,
  status,
  updatedAt
}: {
  id: string;
  createdAt: string;
  input: AdminCreateReservationInput | CreateReservationRequestInput;
  room: Room;
  source: "admin" | "website";
  status: ReservationRequest["status"];
  updatedAt: string;
}) {
  const pricing = getStayPricing(room, input.checkIn, input.checkOut);

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
    ...pricing
  });
}

export async function createReservationRequest(input: CreateReservationRequestInput, room: Room) {
  const now = new Date().toISOString();

  const items = await readReservationFile();
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
    room,
    source: "website",
    status: "new",
    updatedAt: now
  });

  await writeReservationFile([item, ...items]);
  return item;
}

export async function createAdminReservation(rawInput: unknown, rooms: Room[]) {
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
}

export async function updateReservationRequest(rawInput: unknown, rooms: Room[]) {
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
    room,
    source: items[index].source,
    status: input.status,
    updatedAt: now
  });

  const next = items.map((item, currentIndex) => (currentIndex === index ? updated : item));
  await writeReservationFile(next);
  return updated;
}
