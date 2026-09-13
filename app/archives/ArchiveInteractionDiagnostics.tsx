"use client";

import { useEffect, useState } from "react";

type DiagnosticState = {
  event: string;
  target: string;
  carton: string;
  disabled: string;
  experience: string;
  overlay: string;
  stack: string;
};

const emptyState: DiagnosticState = {
  event: "waiting",
  target: "—",
  carton: "—",
  disabled: "—",
  experience: "—",
  overlay: "—",
  stack: "—",
};

function describeElement(element: Element | null) {
  if (!element) return "none";
  const id = element.id ? `#${element.id}` : "";
  const className = typeof (element as HTMLElement).className === "string"
    ? (element as HTMLElement).className.trim().split(/\s+/).filter(Boolean).slice(0, 3).map((name) => `.${name}`).join("")
    : "";
  return `${element.tagName.toLowerCase()}${id}${className}`;
}

export function ArchiveInteractionDiagnostics() {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<DiagnosticState>(emptyState);

  useEffect(() => {
    const debugEnabled = new URLSearchParams(window.location.search).get("archiveDebug") === "1";
    if (!debugEnabled) return;
    setEnabled(true);

    const capture = (label: string, event: PointerEvent | MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const carton = target?.closest<HTMLButtonElement>(".archive-box--available, .archive-case-box") ?? null;
      const experience = document.querySelector<HTMLElement>(".archive-experience");
      const overlay = document.querySelector<HTMLElement>(".archive-collection-focus");
      const underPointer = document.elementsFromPoint(event.clientX, event.clientY)
        .slice(0, 6)
        .map(describeElement)
        .join(" > ");

      setState({
        event: `${label}${event.defaultPrevented ? " · prevented" : ""}`,
        target: describeElement(target),
        carton: describeElement(carton),
        disabled: carton ? String(carton.disabled) : "n/a",
        experience: experience?.className ?? "missing",
        overlay: overlay ? `mounted · ${getComputedStyle(overlay).display} · ${getComputedStyle(overlay).visibility}` : "not mounted",
        stack: underPointer || "none",
      });

      window.setTimeout(() => {
        const nextExperience = document.querySelector<HTMLElement>(".archive-experience");
        const nextOverlay = document.querySelector<HTMLElement>(".archive-collection-focus");
        setState((current) => ({
          ...current,
          experience: nextExperience?.className ?? "missing",
          overlay: nextOverlay ? `mounted · ${getComputedStyle(nextOverlay).display} · ${getComputedStyle(nextOverlay).visibility}` : "not mounted",
        }));
      }, 120);
    };

    const onPointerDown = (event: PointerEvent) => capture("pointerdown", event);
    const onClick = (event: MouseEvent) => capture("click", event);

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!enabled) return null;

  return (
    <aside
      aria-live="polite"
      style={{
        position: "fixed",
        zIndex: 9999,
        right: 12,
        bottom: 12,
        width: "min(420px, calc(100vw - 24px))",
        padding: 12,
        border: "1px solid rgba(212,190,121,.55)",
        borderRadius: 10,
        background: "rgba(5,5,5,.94)",
        color: "#f5f1e7",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        lineHeight: 1.45,
        boxShadow: "0 18px 48px rgba(0,0,0,.55)",
        pointerEvents: "none",
      }}
    >
      <strong style={{ color: "#d4be79" }}>ARCHIVE INTERACTION DEBUG</strong>
      <div>event: {state.event}</div>
      <div>target: {state.target}</div>
      <div>carton: {state.carton}</div>
      <div>disabled: {state.disabled}</div>
      <div>experience: {state.experience}</div>
      <div>overlay: {state.overlay}</div>
      <div style={{ marginTop: 4, opacity: 0.72 }}>stack: {state.stack}</div>
    </aside>
  );
}
