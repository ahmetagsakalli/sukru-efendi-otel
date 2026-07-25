"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BOOKING_CURRENCY, getGuestCount, getRoomCapacityLimit } from "@/lib/booking";
import {
  defaultLocale,
  getPublicCopy,
  interpolate,
  type PublicLocale
} from "@/lib/i18n";
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
  capacityLimit: number;
  currency: string;
  estimatedTotal: number;
  isAvailable: boolean;
  nights: number;
  pricePerNight: number;
  priceLabel: string;
  roomTitle: string;
  roomSlug: string;
  totalRooms: number;
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

const currencyLocales: Record<PublicLocale, string> = {
  tr: "tr-TR",
  en: "en-US",
  de: "de-DE"
};

function formatCurrency(amount: number, locale: PublicLocale, currency = BOOKING_CURRENCY) {
  return new Intl.NumberFormat(currencyLocales[locale], {
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(amount);
}

function getNightLabel(nights: number, locale: PublicLocale, fallback: string) {
  if (locale === "en") return nights === 1 ? "night" : "nights";
  if (locale === "de") return nights === 1 ? "Nacht" : "Nächte";
  return fallback;
}

export function BookingForm({ rooms, locale = defaultLocale }: { rooms: Room[]; locale?: PublicLocale }) {
  const defaultRoom = rooms[1] ?? rooms[0];
  const copy = getPublicCopy(locale);
  const hasInitialAvailabilityQuery = Boolean(defaultRoom?.slug);
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
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(hasInitialAvailabilityQuery);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRoom = useMemo(() => rooms.find((room) => room.slug === form.roomSlug) ?? defaultRoom, [defaultRoom, form.roomSlug, rooms]);
  const selectedRoomCapacity = selectedRoom ? getRoomCapacityLimit(selectedRoom) : 1;
  const adults = Number(form.adults);
  const children = Number(form.children);
  const guestCount = getGuestCount(adults, children);
  const datesAreValid = Boolean(form.checkIn && form.checkOut && form.checkOut > form.checkIn);
  const selectedRoomAvailability = availability?.roomSlug === selectedRoom?.slug ? availability : null;
  const isUnavailable = selectedRoomAvailability ? !selectedRoomAvailability.isAvailable : false;
  const occupancyError =
    selectedRoom && guestCount > selectedRoomCapacity
      ? interpolate(copy.bookingForm.occupancyError, {
          capacity: selectedRoomCapacity,
          room: selectedRoom.title
        })
      : "";
  const adultOptions = useMemo(
    () => Array.from({ length: Math.max(selectedRoomCapacity, 1) }, (_, index) => String(index + 1)),
    [selectedRoomCapacity]
  );
  const childOptions = useMemo(() => {
    const remainingCapacity = Math.max(selectedRoomCapacity - Math.max(adults, 1), 0);
    return Array.from({ length: remainingCapacity + 1 }, (_, index) => String(index));
  }, [adults, selectedRoomCapacity]);

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
          setAvailabilityError(locale === "tr" ? result.error ?? copy.bookingForm.availabilityFailed : copy.bookingForm.availabilityFailed);
          return;
        }

        setAvailability(result.rooms[0]);
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setAvailability(null);
          setAvailabilityError(copy.bookingForm.availabilityFailed);
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

      const nextRoom = rooms.find((room) => room.slug === next.roomSlug) ?? defaultRoom;

      if (nextRoom) {
        const capacityLimit = getRoomCapacityLimit(nextRoom);
        const nextAdults = Math.min(Math.max(Number(next.adults) || 1, 1), capacityLimit);
        const nextChildren = Math.min(Math.max(Number(next.children) || 0, 0), Math.max(capacityLimit - nextAdults, 0));
        next.adults = String(nextAdults);
        next.children = String(nextChildren);
      }

      return next;
    });
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      if (occupancyError) {
        setMessageType("error");
        setMessage(occupancyError);
        return;
      }

      if (selectedRoomAvailability && !selectedRoomAvailability.isAvailable) {
        setMessageType("error");
        setMessage(copy.bookingForm.unavailableSelected);
        return;
      }

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
          id?: string;
          nights?: number;
          paymentStatus?: string;
          totalLabel?: string;
        };
        payment?: {
          required?: boolean;
          status?: string;
        };
      };

      if (!response.ok) {
        const issue = result.issues?.[0];
        setMessageType("error");
        setMessage(locale === "tr" ? issue ? issue.message : result.error ?? copy.bookingForm.requestFailed : copy.bookingForm.requestFailed);
        return;
      }

      if (result.payment?.required && result.reservation?.id) {
        setMessageType("success");
        setMessage(copy.bookingForm.paymentRedirect);

        const paymentResponse = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: result.reservation.id })
        });
        const paymentResult = (await paymentResponse.json().catch(() => ({}))) as {
          error?: string;
          payment?: {
            redirectUrl?: string;
          };
        };

        if (!paymentResponse.ok || !paymentResult.payment?.redirectUrl) {
          setMessageType("error");
          setMessage(
            locale === "tr" ? paymentResult.error ?? copy.bookingForm.paymentStartFailed : copy.bookingForm.paymentStartFailed
          );
          return;
        }

        window.location.assign(paymentResult.payment.redirectUrl);
        return;
      }

      setMessageType("success");
      const totalLabel =
        selectedRoomAvailability?.estimatedTotal && selectedRoomAvailability.estimatedTotal > 0
          ? formatCurrency(selectedRoomAvailability.estimatedTotal, locale, selectedRoomAvailability.currency)
          : result.reservation?.totalLabel;
      setMessage(
        totalLabel
          ? interpolate(copy.bookingForm.requestWithTotal, {
              id: result.reservation?.id?.slice(0, 8) ?? "-",
              total: totalLabel
            })
          : copy.bookingForm.requestWithoutTotal
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
      setMessage(copy.bookingForm.connectionError);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedPriceLabel = selectedRoomAvailability
    ? formatCurrency(selectedRoomAvailability.pricePerNight, locale, selectedRoomAvailability.currency)
    : "";
  const selectedTotalLabel = selectedRoomAvailability
    ? formatCurrency(selectedRoomAvailability.estimatedTotal, locale, selectedRoomAvailability.currency)
    : "";

  return (
    <section className="hero-reservation" id="rezervasyon" aria-label={copy.bookingForm.ariaLabel}>
      <form className="booking-form booking-form--hero booking-form--request" onSubmit={submitReservation}>
        <label>
          <span>{copy.bookingForm.checkIn}</span>
          <input min={today()} onChange={(event) => updateField("checkIn", event.target.value)} required type="date" value={form.checkIn} />
        </label>
        <label>
          <span>{copy.bookingForm.checkOut}</span>
          <input min={addDays(form.checkIn || today(), 1)} onChange={(event) => updateField("checkOut", event.target.value)} required type="date" value={form.checkOut} />
        </label>
        <label>
          <span>{copy.bookingForm.room}</span>
          <select onChange={(event) => updateField("roomSlug", event.target.value)} required value={selectedRoom?.slug ?? ""}>
            {rooms.map((room) => (
              <option key={room.slug} value={room.slug}>
                {room.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.bookingForm.adults}</span>
          <select onChange={(event) => updateField("adults", event.target.value)} value={form.adults}>
            {adultOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.bookingForm.children}</span>
          <select onChange={(event) => updateField("children", event.target.value)} value={form.children}>
            {childOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.bookingForm.name}</span>
          <input autoComplete="name" onChange={(event) => updateField("name", event.target.value)} required type="text" value={form.name} />
        </label>
        <label>
          <span>{copy.bookingForm.phone}</span>
          <input autoComplete="tel" onChange={(event) => updateField("phone", event.target.value)} required type="tel" value={form.phone} />
        </label>
        <label>
          <span>{copy.bookingForm.email}</span>
          <input autoComplete="email" onChange={(event) => updateField("email", event.target.value)} type="email" value={form.email} />
        </label>
        <label className="booking-form__note">
          <span>{copy.bookingForm.note}</span>
          <input onChange={(event) => updateField("note", event.target.value)} type="text" value={form.note} />
        </label>
        <div className={`booking-form__summary${occupancyError || isUnavailable || availabilityError ? " booking-form__summary--warning" : ""}`}>
          <strong>
            {occupancyError
              ? copy.bookingForm.capacityExceeded
              : isCheckingAvailability
              ? copy.bookingForm.checkingAvailability
              : availabilityError
                ? copy.bookingForm.availabilityFailed
                : selectedRoomAvailability?.isAvailable
                  ? selectedTotalLabel
                  : copy.bookingForm.unavailable}
          </strong>
          <span>
            {occupancyError
              ? occupancyError
              : selectedRoomAvailability?.isAvailable
                ? `${selectedRoomAvailability.nights} ${getNightLabel(selectedRoomAvailability.nights, locale, copy.bookingForm.nights)} · ${selectedRoomAvailability.availableRooms}/${selectedRoomAvailability.totalRooms} ${copy.bookingForm.roomsAvailable} · ${selectedPriceLabel} / ${copy.bookingForm.perNight} · ${guestCount}/${selectedRoomCapacity} ${copy.bookingForm.guests}`
                : availabilityError || copy.bookingForm.noAvailabilitySuggestion}
          </span>
        </div>
        <label className="booking-form__honeypot">
          <span>{copy.bookingForm.website}</span>
          <input autoComplete="off" onChange={(event) => updateField("website", event.target.value)} tabIndex={-1} type="text" value={form.website} />
        </label>
        <button className="booking-link booking-link--solid booking-form__button" disabled={isSubmitting || isCheckingAvailability || !datesAreValid || isUnavailable || Boolean(occupancyError)} type="submit">
          {isSubmitting
            ? copy.bookingForm.submitting
            : occupancyError
              ? copy.bookingForm.capacityExceeded
              : isUnavailable
                ? copy.bookingForm.chooseDate
                : copy.bookingForm.submit}
        </button>
        {message ? <p className={`booking-form__message booking-form__message--${messageType}`}>{message}</p> : null}
      </form>
    </section>
  );
}
