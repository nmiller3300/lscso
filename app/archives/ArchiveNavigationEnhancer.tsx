"use client";

import { useEffect, useRef } from "react";

const SWIPE_THRESHOLD = 52;
const MAX_VERTICAL_DRIFT = 86;

function roomIsNavigable() {
  return Boolean(document.querySelector(".archive-experience.is-lit:not(.is-collection-open) .archive-room-nav"));
}

function pressRoomNav(direction: -1 | 1) {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".archive-room-nav > button");
  const target = direction < 0 ? buttons[0] : buttons[1];
  if (target && !target.disabled) target.click();
}

export function ArchiveNavigationEnhancer() {
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);

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

    const onTouchStart = (event: TouchEvent) => {
      if (!roomIsNavigable() || event.touches.length !== 1) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select")) return;
      const touch = event.touches[0];
      touchOrigin.current = { x: touch.clientX, y: touch.clientY };
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!touchOrigin.current || !roomIsNavigable() || event.changedTouches.length !== 1) {
        touchOrigin.current = null;
        return;
      }

      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchOrigin.current.x;
      const dy = touch.clientY - touchOrigin.current.y;
      touchOrigin.current = null;

      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > MAX_VERTICAL_DRIFT || Math.abs(dx) <= Math.abs(dy)) return;
      pressRoomNav(dx > 0 ? -1 : 1);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return null;
}
