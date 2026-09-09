"use client";

import Image from "next/image";
import { useId } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import styles from "./BookingPickers.module.css";

export type BookingOption = {
  value: string;
  label: string;
  description?: string;
  image?: string;
};
type BookingSelectProps = {
  name: "roomSlug" | "adults" | "children";
  label: string;
  value: string;
  options: BookingOption[];
  onChange: (name: BookingSelectProps["name"], value: string) => void;
  open: boolean;
  onOpenChange: (name: BookingSelectProps["name"], open: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function BookingSelect({
  name,
  label,
  value,
  options,
  onChange,
  open,
  onOpenChange,
  disabled,
  compact = false,
}: BookingSelectProps) {
  const id = useId();
  const selected = options.find((option) => option.value === value);

  function changeOpen(nextOpen: boolean) {
    onOpenChange(name, nextOpen);
  }

  function selectValue(nextValue: string) {
    if (nextValue) onChange(name, nextValue);
  }

  return (
    <Select.Root
      open={open}
      onOpenChange={changeOpen}
      name={name}
      value={value}
      onValueChange={selectValue}
      disabled={disabled}
    >
      <Select.Trigger
        type="button"
        aria-label={label}
        className={`${styles.selectTrigger} ${compact ? styles.numberTrigger : ""}`}
      >
        <Select.Value>{selected?.label}</Select.Value>
        <Select.Icon className={styles.triggerChevron}>
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={`${styles.panel} ${compact ? styles.numberPanel : styles.roomPanel}`}
          position="popper"
          sideOffset={9}
          align="start"
          collisionPadding={12}
          aria-label={label}
        >
          <div className={options.length > 4 ? styles.scrollButtonSlot : undefined}>
            <Select.ScrollUpButton className={styles.scrollButton}>
              <ChevronUp size={16} aria-hidden="true" />
            </Select.ScrollUpButton>
          </div>
          <Select.Viewport className={styles.options}>
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                textValue={option.label}
                aria-label={option.label}
                aria-describedby={
                  option.description ? `${id}-${option.value}` : undefined
                }
                className={`${styles.option} ${compact ? styles.numberOption : ""}`}
              >
                {option.image && (
                  <Image
                    className={styles.roomImage}
                    src={option.image}
                    alt=""
                    width={58}
                    height={62}
                    sizes="58px"
                  />
                )}
                <span className={styles.optionCopy}>
                  <Select.ItemText>
                    <span className={styles.optionTitle}>{option.label}</span>
                  </Select.ItemText>
                  {option.description && (
                    <span
                      className={styles.optionDescription}
                      id={`${id}-${option.value}`}
                    >
                      {option.description}
                    </span>
                  )}
                </span>
                <span className={styles.selectionMark} aria-hidden="true">
                  <Select.ItemIndicator>
                    <Check size={13} strokeWidth={1.6} />
                  </Select.ItemIndicator>
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
          <div className={options.length > 4 ? styles.scrollButtonSlot : undefined}>
            <Select.ScrollDownButton className={styles.scrollButton}>
              <ChevronDown size={16} aria-hidden="true" />
            </Select.ScrollDownButton>
          </div>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
