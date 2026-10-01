"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PortalDateFieldProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  min?: string;
  disabled?: boolean;
  placeholder?: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatForDisplay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function parseDate(value: string) {
  const clean = value.trim();
  if (!clean) return "";

  let year: number;
  let month: number;
  let day: number;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(clean);
  const friendly = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (friendly) {
    month = Number(friendly[1]);
    day = Number(friendly[2]);
    year = Number(friendly[3]);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;

  return `${year}-${pad(month)}-${pad(day)}`;
}

export function PortalDateField({
  name,
  value,
  defaultValue = "",
  onChange,
  required = false,
  min,
  disabled = false,
  placeholder = "MM/DD/YYYY",
}: PortalDateFieldProps) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const canonicalValue = controlled ? value ?? "" : internalValue;
  const [draft, setDraft] = useState(() => formatForDisplay(canonicalValue));
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement === textRef.current) return;
    setDraft(formatForDisplay(canonicalValue));
  }, [canonicalValue]);

  const minimumDisplay = useMemo(() => min ? formatForDisplay(min) : "", [min]);

  function setValidity(next: string | null) {
    const input = textRef.current;
    if (!input) return;
    if (next === null) input.setCustomValidity("Enter a valid date as MM/DD/YYYY.");
    else if (next && min && next < min) input.setCustomValidity(`Date must be ${minimumDisplay} or later.`);
    else input.setCustomValidity("");
  }

  function commit(next: string) {
    if (!controlled) setInternalValue(next);
    onChange?.(next);
    setValidity(next);
  }

  function handleTextChange(nextDraft: string) {
    setDraft(nextDraft);
    const parsed = parseDate(nextDraft);
    setValidity(parsed);
    if (parsed !== null) commit(parsed);
  }

  function normalizeDraft() {
    const parsed = parseDate(draft);
    setValidity(parsed);
    if (parsed === null) return;
    if (parsed && min && parsed < min) return;
    setDraft(formatForDisplay(parsed));
  }

  function openPicker() {
    if (disabled) return;
    const picker = pickerRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!picker) return;
    try {
      if (picker.showPicker) picker.showPicker();
      else {
        picker.focus();
        picker.click();
      }
    } catch {
      picker.focus();
      picker.click();
    }
  }

  return (
    <span className="portal-date-field">
      {name ? <input name={name} type="hidden" value={canonicalValue} /> : null}
      <input
        ref={textRef}
        className="portal-date-field__text"
        disabled={disabled}
        inputMode="numeric"
        onBlur={normalizeDraft}
        onChange={(event) => handleTextChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type="text"
        value={draft}
      />
      <input
        ref={pickerRef}
        aria-hidden="true"
        className="portal-date-field__native"
        disabled={disabled}
        min={min}
        onChange={(event) => {
          const next = event.target.value;
          commit(next);
          setDraft(formatForDisplay(next));
        }}
        tabIndex={-1}
        type="date"
        value={canonicalValue}
      />
      <button
        aria-label="Open calendar"
        className="portal-date-field__button"
        disabled={disabled}
        onClick={openPicker}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7 3v3M17 3v3M4.5 9h15M5 5.5h14v14H5z" />
        </svg>
      </button>
    </span>
  );
}
