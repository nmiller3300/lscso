"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LATE_NIGHT_START_HOUR = 0;
const LATE_NIGHT_END_HOUR = 5;
const PROMPT_DELAY_MS = 45_000;
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function easternClockParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    hour: Number(value("hour")),
    dateKey: `${value("year")}-${value("month")}-${value("day")}`,
  };
}

function isPortalWorkArea(pathname: string) {
  if (pathname === "/portal") return false;
  if (pathname.startsWith("/portal/maintenance")) return false;
  if (pathname.startsWith("/portal/test-login")) return false;
  if (pathname.startsWith("/portal/onboarding")) return false;
  return pathname.startsWith("/portal/");
}

export function LateNightCoffee() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pouring, setPouring] = useState(false);
  const [ready, setReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const pourTimer = useRef<number | null>(null);

  const closeCoffee = () => setOpen(false);

  useEffect(() => {
    const handleManualOpen = () => {
      setPouring(false);
      setReady(false);
      setOpen(true);
    };

    window.addEventListener("lscso:coffee-break", handleManualOpen);
    return () => window.removeEventListener("lscso:coffee-break", handleManualOpen);
  }, []);

  useEffect(() => {
    if (!isPortalWorkArea(pathname)) return;

    const forcePreview = new URLSearchParams(window.location.search).get("coffee") === "1";
    const { hour, dateKey } = easternClockParts();
    const isLate = hour >= LATE_NIGHT_START_HOUR && hour < LATE_NIGHT_END_HOUR;
    if (!forcePreview && !isLate) return;

    const storageKey = `lscso-coffee-${dateKey}`;
    if (!forcePreview && window.localStorage.getItem(storageKey)) return;

    const timer = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, "shown");
      setOpen(true);
    }, forcePreview ? 300 : PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCoffee();
        return;
      }

      if (event.key !== "Tab" || !cardRef.current) return;
      const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      const restoreTarget = restoreFocusRef.current;
      if (restoreTarget?.isConnected) requestAnimationFrame(() => restoreTarget.focus());
    };
  }, [open]);

  useEffect(
    () => () => {
      if (pourTimer.current) window.clearTimeout(pourTimer.current);
    },
    [],
  );

  const pourCup = () => {
    setReady(false);
    setPouring(false);
    window.setTimeout(() => setPouring(true), 30);
    if (pourTimer.current) window.clearTimeout(pourTimer.current);
    pourTimer.current = window.setTimeout(() => {
      setPouring(false);
      setReady(true);
    }, 4_600);
  };

  if (!open) return null;

  return (
    <div
      className="portal-coffee-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeCoffee();
      }}
    >
      <div
        ref={cardRef}
        className="portal-coffee-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-coffee-title"
        aria-describedby="portal-coffee-description"
      >
        <button
          ref={closeButtonRef}
          className="portal-coffee-close"
          type="button"
          onClick={closeCoffee}
          aria-label="Dismiss coffee break"
        >
          ×
        </button>

        <div
          className={`portal-coffee-machine ${pouring ? "is-pouring" : ""} ${ready ? "is-ready" : ""}`}
          aria-hidden="true"
        >
          <div className="portal-coffee-machine__header">
            <span className="portal-coffee-machine__button portal-coffee-machine__button--one" />
            <span className="portal-coffee-machine__button portal-coffee-machine__button--two" />
            <span className="portal-coffee-machine__display" />
            <span className="portal-coffee-machine__details" />
          </div>
          <div className="portal-coffee-machine__middle">
            <span className="portal-coffee-machine__exit" />
            <span className="portal-coffee-machine__arm" />
            <span className="portal-coffee-machine__liquid" />
            <span className="portal-coffee-machine__steam portal-coffee-machine__steam--one" />
            <span className="portal-coffee-machine__steam portal-coffee-machine__steam--two" />
            <span className="portal-coffee-machine__steam portal-coffee-machine__steam--three" />
            <span className="portal-coffee-machine__cup" />
          </div>
          <div className="portal-coffee-machine__footer" />
        </div>

        <div className="portal-coffee-copy">
          <span>LSCSO Night Shift</span>
          <h2 id="portal-coffee-title">Burning the midnight oil? Have a cup of joe.</h2>
          <p id="portal-coffee-description">
            {ready
              ? "Fresh pot. Back to the shift."
              : "The pot is always on in Personnel Operations. Take a minute, then get back to it."}
          </p>
        </div>

        <div className="portal-coffee-actions">
          <button
            className="portal-button portal-button--primary"
            type="button"
            onClick={pourCup}
            disabled={pouring}
          >
            {pouring ? "Brewing…" : ready ? "Pour another" : "Pour a cup"}
          </button>
          <button className="portal-button portal-button--secondary" type="button" onClick={closeCoffee}>
            I’m good
          </button>
        </div>
      </div>
    </div>
  );
}
