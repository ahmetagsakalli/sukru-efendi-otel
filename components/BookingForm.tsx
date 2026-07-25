"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Room } from "@/lib/site-content-schema";

type BookingFormState = {
  checkIn: string;
  checkOut: string;
  roomSlug: string;
  adults: string;
  children: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  website: string;
};

type AvailabilityRoom = {
  availableRooms: number;
  estimatedTotal: number;
  isAvailable: boolean;
  nights: number;
  priceLabel: string;
  roomSlug: string;
  totalLabel: string;
};

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today() {
  return formatDateOnly(new Date());
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + days);
  return formatDateOnly(date);
}

function tomorrow() {
  return addDays(today(), 1);
}

export function BookingForm({ rooms }: { rooms: Room[] }) {
  const defaultRoom = rooms[1] ?? rooms[0];
  const [form, setForm] = useState<BookingFormState>({
    checkIn: today(),
    checkOut: tomorrow(),
    roomSlug: defaultRoom?.slug ?? "",
    adults: "2",
    children: "0",
    name: "",
    phone: "",
    email: "",
    note: "",
    website: ""
  });
  const [availability, setAvailability] = useState<AvailabilityRoom | null>(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRoom = useMemo(() => rooms.find((room) => room.slug === form.roomSlug) ?? defaultRoom, [defaultRoom, form.roomSlug, rooms]);
  const datesAreValid = Boolean(form.checkIn && form.checkOut && form.checkOut > form.checkIn);
  const selectedRoomAvailability = availability?.roomSlug === selectedRoom?.slug ? availability : null;
  const isUnavailable = selectedRoomAvailability ? !selectedRoomAvailability.isAvailable : false;

  useEffect(() => {
    if (!selectedRoom?.slug || !datesAreValid) {
      setAvailability(null);
      setAvailabilityError("");
      setIsCheckingAvailability(false);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams({
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      roomSlug: selectedRoom.slug
    });

    setIsCheckingAvailability(true);
    setAvailabilityError("");

    fetch(`/api/availability?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
          rooms?: AvailabilityRoom[];
        };

        if (!response.ok || !result.rooms?.[0]) {
          setAvailability(null);
          setAvailabilityError(result.error ?? "Müsaitlik alınamadı.");
          return;
        }

        setAvailability(result.rooms[0]);
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setAvailability(null);
          setAvailabilityError("Müsaitlik alınamadı.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsCheckingAvailability(false);
        }
      });

    return () => controller.abort();
  }, [datesAreValid, form.checkIn, form.checkOut, selectedRoom?.slug]);

  function updateField(field: keyof BookingFormState, value: string) {
    setMessage("");
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "checkIn" && value && (!current.checkOut || current.checkOut <= value)) {
        next.checkOut = addDays(value, 1);
      }

      return next;
    });
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const payload = {
        ...form,
        adults: Number(form.adults),
        children: Number(form.children),
        email: form.email.trim(),
        name: form.name.trim(),
        note: form.note.trim(),
        phone: form.phone.trim(),
        website: form.website.trim()
      };

      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        issues?: Array<{ path: string; message: string }>;
        reservation?: {
          nights?: number;
          totalLabel?: string;
        };
      };

      if (!response.ok) {
        const issue = result.issues?.[0];
        setMessageType("error");
        setMessage(issue ? issue.message : result.error ?? "Talep gönderilemedi.");
        return;
      }

      setMessageType("success");
      setMessage(
        result.reservation?.totalLabel
          ? `Talebiniz alındı. Tahmini toplam ${result.reservation.totalLabel}. Otel kısa süre içinde sizinle iletişime geçecek.`
          : "Talebiniz alındı. Otel kısa süre içinde sizinle iletişime geçecek."
      );
      setForm((current) => ({
        ...current,
        name: "",
        phone: "",
        email: "",
        note: "",
        website: ""
      }));
    } catch {
      setMessageType("error");
      setMessage("Bağlantı kurulamadı. Lütfen telefon veya WhatsApp üzerinden bize ulaşın.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="hero-reservation" id="rezervasyon" aria-label="Rezervasyon">
      <form className="booking-form booking-form--hero booking-form--request" onSubmit={submitReservation}>
        <label>
          <span>Giriş</span>
          <input min={today()} onChange={(event) => updateField("checkIn", event.target.value)} required type="date" value={form.checkIn} />
        </label>
        <label>
          <span>Çıkış</span>
          <input min={addDays(form.checkIn || today(), 1)} onChange={(event) => updateField("checkOut", event.target.value)} required type="date" value={form.checkOut} />
        </label>
        <label>
          <span>Oda</span>
          <select onChange={(event) => updateField("roomSlug", event.target.value)} required value={selectedRoom?.slug ?? ""}>
            {rooms.map((room) => (
              <option key={room.slug} value={room.slug}>
                {room.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Yetişkin</span>
          <select onChange={(event) => updateField("adults", event.target.value)} value={form.adults}>
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
            <option>5</option>
            <option>6</option>
          </select>
        </label>
        <label>
          <span>Çocuk</span>
          <select onChange={(event) => updateField("children", event.target.value)} value={form.children}>
            <option>0</option>
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
          </select>
        </label>
        <label>
          <span>Ad Soyad</span>
          <input autoComplete="name" onChange={(event) => updateField("name", event.target.value)} required type="text" value={form.name} />
        </label>
        <label>
          <span>Telefon</span>
          <input autoComplete="tel" onChange={(event) => updateField("phone", event.target.value)} required type="tel" value={form.phone} />
        </label>
        <label>
          <span>E-posta</span>
          <input autoComplete="email" onChange={(event) => updateField("email", event.target.value)} type="email" value={form.email} />
        </label>
        <label className="booking-form__note">
          <span>Not</span>
          <input onChange={(event) => updateField("note", event.target.value)} type="text" value={form.note} />
        </label>
        <div className={`booking-form__summary${isUnavailable || availabilityError ? " booking-form__summary--warning" : ""}`}>
          <strong>
            {isCheckingAvailability
              ? "Müsaitlik kontrol ediliyor"
              : availabilityError
                ? "Müsaitlik alınamadı"
                : selectedRoomAvailability?.isAvailable
                  ? selectedRoomAvailability.totalLabel
                  : "Müsait oda yok"}
          </strong>
          <span>
            {selectedRoomAvailability?.isAvailable
              ? `${selectedRoomAvailability.nights} gece · ${selectedRoomAvailability.availableRooms} oda müsait · ${selectedRoomAvailability.priceLabel} / gece`
              : availabilityError || "Farklı tarih veya oda seçin"}
          </span>
        </div>
        <label className="booking-form__honeypot">
          <span>Web sitesi</span>
          <input autoComplete="off" onChange={(event) => updateField("website", event.target.value)} tabIndex={-1} type="text" value={form.website} />
        </label>
        <button className="booking-link booking-link--solid booking-form__button" disabled={isSubmitting || isCheckingAvailability || !datesAreValid || isUnavailable} type="submit">
          {isSubmitting ? "Gönderiliyor" : isUnavailable ? "Uygun Tarih Seçin" : "Rezervasyon Talebi Gönder"}
        </button>
        {message ? <p className={`booking-form__message booking-form__message--${messageType}`}>{message}</p> : null}
      </form>
    </section>
  );
}
