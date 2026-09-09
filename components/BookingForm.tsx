"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Plus,
  Users,
} from "lucide-react";
import { bookingCopy } from "./booking-copy";
import styles from "./BookingForm.module.css";
import { BookingSelect } from "./BookingSelect";
import { BookingDatePicker } from "./BookingDatePicker";
import {
  BOOKING_CURRENCY,
  getGuestCount,
  getRoomCapacityLimit,
} from "@/lib/booking";
import {
  defaultLocale,
  getPublicCopy,
  interpolate,
  type PublicLocale,
} from "@/lib/i18n";
import type { BookingInitialValues } from "@/lib/booking-url";
import { MAX_ADULTS, MAX_CHILDREN } from "@/lib/booking-limits";
import type { Room, BookingSettings } from "@/lib/site-content-schema";

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
  checkIn: string;
  checkOut: string;
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

type BookingFormProps = {
  settings?: BookingSettings;
  hotelName?: string;
  initialValues?: BookingInitialValues;
  locale?: PublicLocale;
  rooms: Room[];
  sectionClassName?: string;
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
  de: "de-DE",
};

const adultOptions = Array.from({ length: MAX_ADULTS }, (_, index) => String(index + 1));
const childOptions = Array.from({ length: MAX_CHILDREN + 1 }, (_, index) => String(index));

function formatCurrency(
  amount: number,
  locale: PublicLocale,
  currency = BOOKING_CURRENCY,
) {
  return new Intl.NumberFormat(currencyLocales[locale], {
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function getNightLabel(nights: number, locale: PublicLocale, fallback: string) {
  if (locale === "en") return nights === 1 ? "night" : "nights";
  if (locale === "de") return nights === 1 ? "Nacht" : "Nächte";
  return fallback;
}

export function BookingForm({
  settings,
  hotelName = "Şükrü Efendi",
  initialValues,
  rooms,
  locale = defaultLocale,
  sectionClassName,
}: BookingFormProps) {
  const defaultRoom = rooms[1] ?? rooms[0];
  const copy = getPublicCopy(locale);
  const designCopy = { ...bookingCopy[locale], ...settings?.copy[locale] };
  const formId = useId();
  const [activePicker, setActivePicker] = useState<
    keyof BookingFormState | null
  >(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<"stay" | "details" | "success">("stay");
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const hasInitialAvailabilityQuery = Boolean(defaultRoom?.slug);
  const initialBookingFields = useMemo(
    () => ({
      checkIn: initialValues?.checkIn ?? today(),
      checkOut: initialValues?.checkOut ?? tomorrow(),
      roomSlug: initialValues?.roomSlug ?? defaultRoom?.slug ?? "",
      adults: initialValues?.adults ?? "2",
      children: initialValues?.children ?? "0",
    }),
    [
      defaultRoom?.slug,
      initialValues?.adults,
      initialValues?.checkIn,
      initialValues?.checkOut,
      initialValues?.children,
      initialValues?.roomSlug,
    ],
  );
  const [form, setForm] = useState<BookingFormState>({
    ...initialBookingFields,
    name: "",
    phone: "",
    email: "",
    note: "",
    website: "",
  });
  const [availability, setAvailability] = useState<AvailabilityRoom | null>(
    null,
  );
  const [availabilityError, setAvailabilityError] = useState("");
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(
    hasInitialAvailabilityQuery,
  );
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.slug === form.roomSlug) ?? defaultRoom,
    [defaultRoom, form.roomSlug, rooms],
  );
  const selectedRoomCapacity = selectedRoom
    ? getRoomCapacityLimit(selectedRoom)
    : 1;
  const adults = Number(form.adults);
  const children = Number(form.children);
  const guestCount = getGuestCount(adults, children);
  const datesAreValid = Boolean(
    form.checkIn >= today() && form.checkOut && form.checkOut > form.checkIn,
  );
  const selectedRoomAvailability =
    availability?.roomSlug === selectedRoom?.slug &&
    availability?.checkIn === form.checkIn &&
    availability?.checkOut === form.checkOut
      ? availability
      : null;
  const isUnavailable = selectedRoomAvailability
    ? !selectedRoomAvailability.isAvailable
    : false;
  const occupancyError =
    selectedRoom && guestCount > selectedRoomCapacity
      ? interpolate(copy.bookingForm.occupancyError, {
          capacity: selectedRoomCapacity,
          room: selectedRoom.title,
        })
      : "";

  useEffect(() => {
    setForm((current) => ({
      ...current,
      ...initialBookingFields,
    }));
  }, [initialBookingFields]);

  useEffect(() => {
    if (step !== "stay") titleRef.current?.focus();
  }, [step]);

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
      roomSlug: selectedRoom.slug,
    });

    setIsCheckingAvailability(true);
    setAvailabilityError("");
    setAvailability(null);

    fetch(`/api/availability?${query.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
          rooms?: AvailabilityRoom[];
        };

        if (controller.signal.aborted) return;

        if (!response.ok || !result.rooms?.[0]) {
          setAvailability(null);
          setAvailabilityError(
            locale === "tr"
              ? (result.error ?? copy.bookingForm.availabilityFailed)
              : copy.bookingForm.availabilityFailed,
          );
          return;
        }

        setAvailability({
          ...result.rooms[0],
          checkIn: form.checkIn,
          checkOut: form.checkOut,
        });
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
  }, [
    datesAreValid,
    form.checkIn,
    form.checkOut,
    selectedRoom?.slug,
    locale,
    copy.bookingForm.availabilityFailed,
    availabilityVersion,
  ]);

  function changePicker(name: keyof BookingFormState, open: boolean) {
    setActivePicker((current) =>
      open ? name : current === name ? null : current,
    );
  }

  function updateField(field: keyof BookingFormState, value: string) {
    setMessage("");
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (
        field === "checkIn" &&
        value &&
        (!current.checkOut || current.checkOut <= value)
      ) {
        next.checkOut = addDays(value, 1);
      }

      return next;
    });
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !canContinue) return;
    if (step === "stay") {
      setActivePicker(null);
      setStep("details");
      return;
    }
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
        website: form.website.trim(),
      };

      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        issues?: Array<{ path: string; message: string }>;
        reservation?: {
          id?: string;
          nights?: number;
          paymentStatus?: string;
          status?: string;
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
        setMessage(
          locale === "tr"
            ? issue
              ? issue.message
              : (result.error ?? copy.bookingForm.requestFailed)
            : copy.bookingForm.requestFailed,
        );
        return;
      }

      if (result.payment?.required && result.reservation?.id) {
        setMessageType("success");
        setMessage(copy.bookingForm.paymentRedirect);

        const paymentResponse = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: result.reservation.id }),
        });
        const paymentResult = (await paymentResponse
          .json()
          .catch(() => ({}))) as {
          error?: string;
          payment?: {
            redirectUrl?: string;
          };
        };

        if (!paymentResponse.ok || !paymentResult.payment?.redirectUrl) {
          setMessageType("error");
          setMessage(
            locale === "tr"
              ? (paymentResult.error ?? copy.bookingForm.paymentStartFailed)
              : copy.bookingForm.paymentStartFailed,
          );
          return;
        }

        window.location.assign(paymentResult.payment.redirectUrl);
        return;
      }

      setMessageType("success");
      const isConfirmed = result.reservation?.status === "confirmed";
      const totalLabel =
        selectedRoomAvailability?.estimatedTotal &&
        selectedRoomAvailability.estimatedTotal > 0
          ? formatCurrency(
              selectedRoomAvailability.estimatedTotal,
              locale,
              selectedRoomAvailability.currency,
            )
          : result.reservation?.totalLabel;
      setMessage(
        totalLabel
          ? interpolate(
              isConfirmed
                ? copy.bookingForm.confirmedWithTotal
                : copy.bookingForm.requestWithTotal,
              {
                id: result.reservation?.id?.slice(0, 8) ?? "-",
                total: totalLabel,
              },
            )
          : isConfirmed
            ? copy.bookingForm.confirmedWithoutTotal
            : copy.bookingForm.requestWithoutTotal,
      );
      setForm((current) => ({
        ...current,
        name: "",
        phone: "",
        email: "",
        note: "",
        website: "",
      }));
      setStep("success");
      setAvailabilityVersion((version) => version + 1);
    } catch {
      setMessageType("error");
      setMessage(copy.bookingForm.connectionError);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedPriceLabel = selectedRoomAvailability
    ? formatCurrency(
        selectedRoomAvailability.pricePerNight,
        locale,
        selectedRoomAvailability.currency,
      )
    : "";
  const selectedTotalLabel = selectedRoomAvailability
    ? formatCurrency(
        selectedRoomAvailability.estimatedTotal,
        locale,
        selectedRoomAvailability.currency,
      )
    : "";

  const canContinue =
    !isSubmitting &&
    !isCheckingAvailability &&
    datesAreValid &&
    Boolean(selectedRoomAvailability?.isAvailable) &&
    !occupancyError &&
    !availabilityError;
  const availabilityStatus = !datesAreValid
    ? designCopy.selectDates
    : isCheckingAvailability
      ? copy.bookingForm.checkingAvailability
      : occupancyError ||
        availabilityError ||
        (isUnavailable
          ? copy.bookingForm.noAvailabilitySuggestion
          : designCopy.available);
  const hasAvailabilityWarning =
    !datesAreValid ||
    Boolean(occupancyError || availabilityError || isUnavailable);
  const nightSummary = selectedRoomAvailability
    ? `${selectedRoomAvailability.nights} ${getNightLabel(selectedRoomAvailability.nights, locale, copy.bookingForm.nights)} · ${guestCount} ${copy.bookingForm.guests}`
    : "";

  function handleFieldChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    updateField(
      event.target.name as keyof BookingFormState,
      event.target.value,
    );
  }

  function editStay() {
    setActivePicker(null);
    setStep("stay");
    setMessage("");
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  function retryAvailability() {
    setAvailabilityVersion((version) => version + 1);
  }

  return (
    <section
      className={["hero-reservation", styles.shell, sectionClassName]
        .filter(Boolean)
        .join(" ")}
      id="rezervasyon"
      aria-label={copy.bookingForm.ariaLabel}
    >
      <div className={styles.card}>
        <aside className={styles.heritage}>
          <div className={styles.seal}>
            <KeyRound size={23} strokeWidth={1.2} aria-hidden="true" />
            <span className={styles.years}>{settings?.heritageYears ?? 400}</span>
            <span className={styles.heritageLabel}>{designCopy.heritage}</span>
            <span className={styles.ornament} aria-hidden="true">
              ✦
            </span>
          </div>
          <p className={styles.heritageNote}>{designCopy.heritageNote}</p>
          <span className={styles.signature}>
            {hotelName}<span>OTTOMAN HOTEL</span>
          </span>
        </aside>

        <form
          className={styles.form}
          onSubmit={submitReservation}
          aria-busy={isSubmitting}
        >
          <header className={styles.heading}>
            <h2 ref={titleRef} tabIndex={-1}>
              {step === "success"
                ? designCopy.successTitle
                : step === "details"
                  ? designCopy.guestTitle
                  : designCopy.title}
            </h2>
            {step !== "success" && (
              <p>
                {step === "details"
                  ? designCopy.guestIntroduction
                  : designCopy.introduction}
              </p>
            )}
          </header>

          {step === "success" ? (
            <div className={styles.success}>
              <CheckCircle2 size={44} strokeWidth={1} aria-hidden="true" />
              <p role="status">{message}</p>
              <button
                className={styles.textButton}
                onClick={editStay}
                type="button"
              >
                {designCopy.another}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              {step === "stay" ? (
                <fieldset className={styles.stayFields} disabled={isSubmitting}>
                  <legend className={styles.srOnly}>{designCopy.stay}</legend>
                  <BookingDatePicker
                    label={copy.bookingForm.checkIn}
                    name="checkIn"
                    open={activePicker === "checkIn"}
                    onOpenChange={changePicker}
                    value={form.checkIn}
                    min={today()}
                    locale={locale}
                    checkIn={form.checkIn}
                    checkOut={form.checkOut}
                    onChange={updateField}
                    disabled={isSubmitting}
                  />
                  <BookingDatePicker
                    label={copy.bookingForm.checkOut}
                    name="checkOut"
                    open={activePicker === "checkOut"}
                    onOpenChange={changePicker}
                    value={form.checkOut}
                    min={addDays(form.checkIn || today(), 1)}
                    locale={locale}
                    checkIn={form.checkIn}
                    checkOut={form.checkOut}
                    onChange={updateField}
                    disabled={isSubmitting}
                  />
                  <div className={styles.stayField}>
                    <span className={styles.fieldLabel}>
                      <BedDouble size={15} aria-hidden="true" />
                      {copy.bookingForm.room}
                    </span>
                    <div className={styles.selectWrap}>
                      <BookingSelect
                        name="roomSlug"
                        open={activePicker === "roomSlug"}
                        onOpenChange={changePicker}
                        label={copy.bookingForm.room}
                        value={selectedRoom?.slug ?? ""}
                        options={rooms.map((room) => ({
                          value: room.slug,
                          label: room.title,
                          description: `${room.size} · ${room.capacity}`,
                          image: room.image,
                        }))}
                        onChange={updateField}
                        disabled={isSubmitting}
                      />
                    </div>
                    <span className={styles.fieldHint}>
                      {selectedRoom?.size} · {selectedRoom?.capacity}
                    </span>
                  </div>
                  <div className={`${styles.stayField} ${styles.guestField}`}>
                    <span className={styles.fieldLabel}>
                      <Users size={15} aria-hidden="true" />
                      {designCopy.guestCountLabel}
                    </span>
                    <div className={styles.guestControls}>
                      <div>
                        <BookingSelect
                          compact
                          open={activePicker === "adults"}
                          onOpenChange={changePicker}
                          name="adults"
                          label={copy.bookingForm.adults}
                          value={form.adults}
                          options={adultOptions.map((option) => ({
                            value: option,
                            label: option,
                            description: copy.bookingForm.adults,
                          }))}
                          onChange={updateField}
                          disabled={isSubmitting}
                        />
                        <span className={styles.fieldHint}>
                          {copy.bookingForm.adults}
                        </span>
                      </div>
                      <div>
                        <BookingSelect
                          compact
                          open={activePicker === "children"}
                          onOpenChange={changePicker}
                          name="children"
                          label={copy.bookingForm.children}
                          value={form.children}
                          options={childOptions.map((option) => ({
                            value: option,
                            label: option,
                            description: copy.bookingForm.children,
                          }))}
                          onChange={updateField}
                          disabled={isSubmitting}
                        />
                        <span className={styles.fieldHint}>
                          {copy.bookingForm.children}
                        </span>
                      </div>
                    </div>
                  </div>
                </fieldset>
              ) : (
                <>
                  <div className={styles.stayRecap}>
                    <BedDouble size={19} strokeWidth={1.3} aria-hidden="true" />
                    <div>
                      <strong>{selectedRoom?.title}</strong>
                      <span>
                        {formatStayDate(form.checkIn, locale)} —{" "}
                        {formatStayDate(form.checkOut, locale)} · {nightSummary}
                      </span>
                    </div>
                    <button
                      className={styles.textButton}
                      type="button"
                      disabled={isSubmitting}
                      onClick={editStay}
                    >
                      <ArrowLeft size={14} aria-hidden="true" />
                      {designCopy.edit}
                    </button>
                  </div>
                  <fieldset
                    className={styles.contactFields}
                    disabled={isSubmitting}
                  >
                    <legend className={styles.srOnly}>
                      {designCopy.details}
                    </legend>
                    <label>
                      <span>{copy.bookingForm.name}</span>
                      <input
                        name="name"
                        autoComplete="name"
                        onChange={handleFieldChange}
                        required
                        minLength={2}
                        maxLength={120}
                        type="text"
                        value={form.name}
                      />
                    </label>
                    <label>
                      <span>{copy.bookingForm.phone}</span>
                      <input
                        name="phone"
                        autoComplete="tel"
                        onChange={handleFieldChange}
                        required
                        minLength={7}
                        maxLength={40}
                        pattern={"[+\\(\\)0-9\\s\\-]+"}
                        type="tel"
                        value={form.phone}
                      />
                    </label>
                    <label className={styles.emailField}>
                      <span>
                        {copy.bookingForm.email}
                        <small>({designCopy.optional})</small>
                      </span>
                      <input
                        name="email"
                        autoComplete="email"
                        onChange={handleFieldChange}
                        maxLength={180}
                        type="email"
                        value={form.email}
                      />
                    </label>
                    <details className={styles.noteField}>
                      <summary>
                        <Plus size={14} aria-hidden="true" />
                        {designCopy.notePrompt}
                      </summary>
                      <label>
                        <span className={styles.srOnly}>
                          {copy.bookingForm.note}
                        </span>
                        <textarea
                          name="note"
                          placeholder={designCopy.notePlaceholder}
                          rows={2}
                          maxLength={700}
                          onChange={handleFieldChange}
                          value={form.note}
                        />
                      </label>
                    </details>
                  </fieldset>
                </>
              )}

              <div
                className={`${styles.availability} ${hasAvailabilityWarning ? styles.warning : ""}`}
                role="status"
                aria-live="polite"
                id={`${formId}-availability`}
              >
                {isCheckingAvailability ? (
                  <LoaderCircle
                    className={styles.spinner}
                    size={14}
                    aria-hidden="true"
                  />
                ) : !hasAvailabilityWarning ? (
                  <CheckCircle2 size={14} aria-hidden="true" />
                ) : (
                  <CalendarDays size={14} aria-hidden="true" />
                )}
                <span>{availabilityStatus}</span>
                {availabilityError && (
                  <button
                    className={styles.textButton}
                    type="button"
                    onClick={retryAvailability}
                  >
                    {designCopy.retry}
                  </button>
                )}
              </div>

              <div className={styles.bottomline}>
                <div
                  className={styles.price}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className={styles.priceLabel}>{designCopy.total}</span>
                  <div>
                    <strong>
                      {!hasAvailabilityWarning && !isCheckingAvailability
                        ? selectedTotalLabel || "—"
                        : "—"}
                    </strong>
                    <span>
                      {!hasAvailabilityWarning && !isCheckingAvailability
                        ? nightSummary
                        : ""}
                    </span>
                  </div>
                  {selectedRoomAvailability &&
                    !hasAvailabilityWarning &&
                    !isCheckingAvailability && (
                      <small>
                        {selectedPriceLabel} / {copy.bookingForm.perNight}
                      </small>
                    )}
                </div>
                <div className={styles.action}>
                  <button
                    className={styles.primaryButton}
                    disabled={!canContinue}
                    type="submit"
                    aria-describedby={`${formId}-availability`}
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle
                          size={18}
                          className={styles.spinner}
                          aria-hidden="true"
                        />
                        {copy.bookingForm.submitting}
                      </>
                    ) : (
                      <>
                        {step === "stay"
                          ? designCopy.continue
                          : copy.bookingForm.submit}
                        <ArrowRight
                          size={19}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </button>
                </div>
              </div>
              <label className={styles.honeypot} aria-hidden="true">
                <span>{copy.bookingForm.website}</span>
                <input
                  name="website"
                  autoComplete="off"
                  onChange={handleFieldChange}
                  tabIndex={-1}
                  type="text"
                  value={form.website}
                />
              </label>
              {message && (
                <p
                  role={messageType === "error" ? "alert" : "status"}
                  className={`${styles.message} ${messageType === "error" ? styles.warning : ""}`}
                >
                  {message}
                </p>
              )}
            </>
          )}
        </form>
      </div>
    </section>
  );
}

function formatStayDate(value: string, locale: PublicLocale) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(currencyLocales[locale], {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}
