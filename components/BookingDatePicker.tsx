"use client";

import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { tr } from "react-day-picker/locale/tr";
import { enUS } from "react-day-picker/locale/en-US";
import { de } from "react-day-picker/locale/de";
import type { PublicLocale } from "@/lib/i18n";
import "react-day-picker/style.css";
import formStyles from "./BookingForm.module.css";
import styles from "./BookingPickers.module.css";

const locales = { tr, en: enUS, de };
const localeCodes = { tr: "tr-TR", en: "en-US", de: "de-DE" };
const calendarCopy = {
  tr: { previous: "Önceki ay", next: "Sonraki ay", close: "Takvimi kapat" },
  en: {
    previous: "Previous month",
    next: "Next month",
    close: "Close calendar",
  },
  de: {
    previous: "Vorheriger Monat",
    next: "Nächster Monat",
    close: "Kalender schließen",
  },
};

function dateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

type BookingDatePickerProps = {
  label: string;
  name: "checkIn" | "checkOut";
  value: string;
  min: string;
  checkIn: string;
  checkOut: string;
  locale: PublicLocale;
  onChange: (name: BookingDatePickerProps["name"], value: string) => void;
  open: boolean;
  onOpenChange: (name: BookingDatePickerProps["name"], open: boolean) => void;
  disabled?: boolean;
};

export function BookingDatePicker({
  label,
  name,
  value,
  min,
  checkIn,
  checkOut,
  locale,
  onChange,
  open,
  onOpenChange,
  disabled,
}: BookingDatePickerProps) {
  const date = parseDate(value);
  const minimumDate = parseDate(min);
  const valid = Number.isFinite(date.getTime());
  const copy = calendarCopy[locale];
  const localeCode = localeCodes[locale];
  const fullDate = valid
    ? new Intl.DateTimeFormat(localeCode, { dateStyle: "full" }).format(date)
    : "";

  function changeOpen(nextOpen: boolean) {
    onOpenChange(name, nextOpen);
  }

  function selectDate(nextDate: Date) {
    onChange(name, dateOnly(nextDate));
    onOpenChange(name, false);
  }

  return (
    <div className={`${formStyles.stayField} ${styles.dateField}`}>
      <input name={name} type="hidden" value={value} />
      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger asChild>
          <button
            className={styles.dateTrigger}
            type="button"
            disabled={disabled}
            data-booking-date={name}
            aria-label={`${label}, ${fullDate}`}
          >
            <span className={formStyles.fieldLabel}>
              <CalendarDays size={15} aria-hidden="true" />
              {label}
            </span>
            <span className={formStyles.dateDisplay} aria-hidden="true">
              <strong>
                {valid ? String(date.getDate()).padStart(2, "0") : "—"}
              </strong>
              <span>
                {valid
                  ? new Intl.DateTimeFormat(localeCode, {
                      month: "long",
                      year: "numeric",
                    }).format(date)
                  : "—"}
                <small>
                  {valid
                    ? new Intl.DateTimeFormat(localeCode, {
                        weekday: "long",
                      }).format(date)
                    : "—"}
                </small>
              </span>
              <ChevronDown size={14} strokeWidth={1.5} />
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={`${styles.panel} ${styles.calendarPanel}`}
            sideOffset={9}
            align="start"
            collisionPadding={12}
            aria-label={label}
          >
            <div className={styles.calendarHeader}>
              <span>{label}</span>
              <Popover.Close
                className={styles.closeButton}
                aria-label={copy.close}
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </Popover.Close>
            </div>
            <DayPicker
              className={styles.calendar}
              mode="single"
              required
              autoFocus
              locale={locales[locale]}
              weekStartsOn={1}
              navLayout="around"
              selected={valid ? date : undefined}
              defaultMonth={valid && date >= minimumDate ? date : minimumDate}
              startMonth={minimumDate}
              disabled={{ before: minimumDate }}
              onSelect={selectDate}
              fixedWeeks
              showOutsideDays
              modifiers={{
                stay: {
                  after: parseDate(checkIn),
                  before: parseDate(checkOut),
                },
                arrival: parseDate(checkIn),
                departure: parseDate(checkOut),
              }}
              modifiersClassNames={{
                stay: styles.stayDay,
                arrival: styles.arrivalDay,
                departure: styles.departureDay,
              }}
              labels={{
                labelPrevious: () => copy.previous,
                labelNext: () => copy.next,
                labelDayButton: (day) =>
                  new Intl.DateTimeFormat(localeCode, {
                    dateStyle: "full",
                  }).format(day),
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
