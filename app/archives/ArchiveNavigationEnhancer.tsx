"use client";

import { useEffect, useRef } from "react";

const SWIPE_THRESHOLD = 52;
const MAX_VERTICAL_DRIFT = 86;

type PointerOrigin = { id: number; x: number; y: number };

function roomIsNavigable() {
  return Boolean(document.querySelector(".archive-experience.is-lit:not(.is-collection-open) .archive-room-nav"));
}

function pressRoomNav(direction: -1 | 1) {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".archive-room-nav > button");
  const target = direction < 0 ? buttons[0] : buttons[1];
  if (target && !target.disabled) target.click();
}

export function ArchiveNavigationEnhancer() {
  const pointerOrigin = useRef<PointerOrigin | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!roomIsNavigable()) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a, [contenteditable='true']")) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        pressRoomNav(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        pressRoomNav(1);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !event.isPrimary || !roomIsNavigable()) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select")) return;
      pointerOrigin.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };

    const finishPointer = (event: PointerEvent) => {
      const origin = pointerOrigin.current;
      if (!origin || origin.id !== event.pointerId || !roomIsNavigable()) {
        if (origin?.id === event.pointerId) pointerOrigin.current = null;
        return;
      }

      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      pointerOrigin.current = null;

      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > MAX_VERTICAL_DRIFT || Math.abs(dx) <= Math.abs(dy)) return;
      pressRoomNav(dx > 0 ? -1 : 1);
    };

    const cancelPointer = (event: PointerEvent) => {
      if (pointerOrigin.current?.id === event.pointerId) pointerOrigin.current = null;
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointerup", finishPointer, { passive: true });
    document.addEventListener("pointercancel", cancelPointer, { passive: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", finishPointer);
      document.removeEventListener("pointercancel", cancelPointer);
    };
  }, []);

  return null;
}
