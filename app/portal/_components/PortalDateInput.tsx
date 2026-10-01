"use client";

import { useRef, useState } from "react";

type PortalDateInputProps = {
  name: string;
  defaultValue?: string;
  min?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel: string;
};

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseDateInput(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (validIsoDate(value)) return value;

  const delimited = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
  const compact = value.match(/^(\d{2})(\d{2})(\d{4})$/);
  const match = delimited ?? compact;
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return validIsoDate(iso) ? iso : null;
}

function displayDate(value: string) {
  if (!validIsoDate(value)) return "";
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

export function PortalDateInput({ name, defaultValue = "", min, disabled = false, required = false, ariaLabel }: PortalDateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const initialIso = parseDateInput(defaultValue) ?? "";
  const [iso, setIso] = useState(initialIso);
  const [text, setText] = useState(displayDate(initialIso));
  const [invalid, setInvalid] = useState(false);

  function commit(value: string) {
    const parsed = parseDateInput(value);
    if (parsed === null) {
      setInvalid(true);
      setIso("");
      return;
    }
    setInvalid(false);
    setIso(parsed);
    setText(displayDate(parsed));
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker || disabled) return;
    try {
      if (typeof picker.showPicker === "function") picker.showPicker();
      else picker.click();
    } catch {
      picker.focus();
      picker.click();
    }
  }

  return (
    <div className={`portal-friendly-date ${invalid ? "is-invalid" : ""}`}>
      <input name={name} type="hidden" value={iso} />
      <input
        aria-invalid={invalid}
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        inputMode="numeric"
        onBlur={(event) => commit(event.currentTarget.value)}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const parsed = parseDateInput(next);
          if (parsed !== null) {
            setIso(parsed);
            setInvalid(false);
          }
        }}
        placeholder="MM/DD/YYYY"
        required={required}
        type="text"
        value={text}
      />
      <button disabled={disabled} onClick={openPicker} type="button">Calendar</button>
      <input
        aria-hidden="true"
        className="portal-friendly-date__native"
        disabled={disabled}
        min={min}
        onChange={(event) => {
          const next = event.target.value;
          setIso(next);
          setText(displayDate(next));
          setInvalid(false);
        }}
        ref={pickerRef}
        tabIndex={-1}
        type="date"
        value={iso}
      />
      {invalid ? <small>Use MM/DD/YYYY.</small> : null}
    </div>
  );
}
