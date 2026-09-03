"use client";

import { useEffect } from "react";

const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

function topLegacyDialog() {
  const backdrops = Array.from(document.querySelectorAll<HTMLElement>(".portal-modal-backdrop"));
  const backdrop = backdrops.at(-1) ?? null;
  const dialog = backdrop?.querySelector<HTMLElement>("[role='dialog'], [role='alertdialog'], .portal-modal") ?? null;
  return { backdrop, dialog };
}

function requestClose(dialog: HTMLElement) {
  const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
  const explicit = buttons.find((button) => /^close/i.test(button.getAttribute("aria-label") ?? ""));
  const cancel = buttons.find((button) => /^(cancel|close|understood)$/i.test(button.textContent?.trim() ?? ""));
  (explicit ?? cancel)?.click();
}

export function LegacyPortalModalBridge() {
  useEffect(() => {
    let previousFocus: HTMLElement | null = null;
    let previousOverflow = "";
    let activeDialog: HTMLElement | null = null;

    const sync = () => {
      const { dialog } = topLegacyDialog();
      if (dialog === activeDialog) return;

      if (!dialog) {
        if (activeDialog) {
          document.body.style.overflow = previousOverflow;
          const restore = previousFocus;
          previousFocus = null;
          activeDialog = null;
          window.requestAnimationFrame(() => restore?.focus());
        }
        return;
      }

      if (!activeDialog) {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }
      activeDialog = dialog;
      if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
      window.requestAnimationFrame(() => {
        const preferred = dialog.querySelector<HTMLElement>("[autofocus]");
        const first = dialog.querySelector<HTMLElement>(focusableSelector);
        (preferred ?? first ?? dialog).focus();
      });
    };

    const keydown = (event: KeyboardEvent) => {
      const { dialog } = topLegacyDialog();
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose(dialog);
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((item) => !item.hasAttribute("disabled"));
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", keydown);
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", keydown);
      if (activeDialog) document.body.style.overflow = previousOverflow;
    };
  }, []);

  return null;
}
