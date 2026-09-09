"use client";

import { useId, useState } from "react";
import Image from "next/image";
import * as Select from "@radix-ui/react-select";
import * as Popover from "@radix-ui/react-popover";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Search,
  X,
} from "lucide-react";
import type { AdminImage } from "@/lib/site-content-schema";
import { DayPicker } from "react-day-picker";
import { tr } from "react-day-picker/locale/tr";
import "react-day-picker/style.css";
import calendarStyles from "../BookingPickers.module.css";

export function AdminSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  options: Array<[string, string]>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="admin-field">
      <span id={id}>{label}</span>
      <Select.Root
        value={value || "__empty__"}
        onValueChange={(next) => onChange(next === "__empty__" ? "" : next)}
        disabled={disabled}
      >
        <Select.Trigger
          className="admin-select-trigger"
          aria-labelledby={id}
          data-testid={testId}
          data-admin-value={value}
        >
          <Select.Value />
          <Select.Icon>
            <ChevronDown size={16} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="admin-choice-panel"
            position="popper"
            sideOffset={6}
            collisionPadding={12}
          >
            <Select.ScrollUpButton className="admin-choice-scroll">
              <ChevronUp size={16} />
            </Select.ScrollUpButton>
            <Select.Viewport>
              {options.map(([key, title]) => (
                <Select.Item
                  className="admin-choice-option"
                  key={key}
                  value={key || "__empty__"}
                  data-value={key}
                >
                  <Select.ItemText>{title}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={16} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="admin-choice-scroll">
              <ChevronDown size={16} />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

function dateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AdminDateField({
  label,
  value,
  min,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  const validSelected =
    selected && !Number.isNaN(selected.getTime()) ? selected : undefined;
  return (
    <div className="admin-field">
      <span id={id}>{label}</span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          className="admin-select-trigger"
          aria-labelledby={id}
          data-testid={testId}
          disabled={disabled}
          type="button"
        >
          {validSelected
            ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(
                validSelected,
              )
            : "Tarih seçin"}
          <CalendarDays size={17} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={`${calendarStyles.panel} ${calendarStyles.calendarPanel} admin-calendar-panel`}
            sideOffset={6}
            collisionPadding={12}
            aria-label={label}
          >
            <div className={calendarStyles.calendarHeader}>
              {label}
              <Popover.Close
                className={calendarStyles.closeButton}
                aria-label="Takvimi kapat"
              >
                <X size={16} />
              </Popover.Close>
            </div>
            <DayPicker
              mode="single"
              required
              autoFocus
              showOutsideDays
              fixedWeeks
              weekStartsOn={1}
              locale={tr}
              className={calendarStyles.calendar}
              selected={validSelected}
              defaultMonth={validSelected}
              disabled={
                min ? { before: new Date(`${min}T00:00:00`) } : undefined
              }
              labels={{
                labelNext: () => "Sonraki ay",
                labelPrevious: () => "Önceki ay",
              }}
              onSelect={(date) => {
                if (date) {
                  onChange(dateOnly(date));
                  setOpen(false);
                }
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

export function AdminText({
  label,
  value,
  onChange,
  multiline = false,
  maxLength = 1200,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <label className={`admin-field${multiline ? " admin-field--wide" : ""}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

export function AdminImageSelector({
  images,
  label,
  value,
  onChange,
  testId,
}: {
  images: AdminImage[];
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = images.filter((image) =>
    `${image.name} ${image.src}`
      .toLocaleLowerCase("tr-TR")
      .includes(search.toLocaleLowerCase("tr-TR")),
  );
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input type="hidden" data-testid={`${testId}-value`} value={value} />
      <Popover.Trigger
        type="button"
        className="admin-secondary-button"
        aria-label={`${label} için kütüphaneden seç`}
        data-testid={`${testId}-select`}
      >
        <ImageIcon size={16} />
        Kütüphaneden seçin
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="admin-image-library-panel"
          sideOffset={9}
          collisionPadding={12}
          aria-label={`${label} görsel kütüphanesi`}
        >
          <div className="admin-image-library-header">
            <strong>Görsel seçin</strong>
            <Popover.Close aria-label="Görsel kütüphanesini kapat">
              <X size={18} />
            </Popover.Close>
          </div>
          <label className="admin-image-library-search">
            <Search size={16} />
            <input
              aria-label="Görsel kütüphanesinde ara"
              placeholder="Dosya adına göre arayın"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="admin-image-library-grid">
            {filtered.map((image) => (
              <button
                key={image.src}
                type="button"
                aria-label={image.name}
                aria-pressed={image.src === value}
                onClick={() => {
                  onChange(image.src);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Image
                  src={image.src}
                  width={150}
                  height={110}
                  sizes="150px"
                  alt=""
                />
                <span>{image.name}</span>
                {image.src === value && <Check size={17} />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p>Bu aramayla eşleşen görsel bulunamadı.</p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
