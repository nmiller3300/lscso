"use client";

import Link from "next/link";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserPushControl } from "./BrowserPushControl";
import { usePortalProfile } from "./PortalProfileProvider";
import { PasswordChangeDialog } from "./PasswordChangeDialog";
import { PortalSignOut } from "./PortalSignOut";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function PortalAccountMenu() {
  const profile = usePortalProfile();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const closeMenu = useCallback(() => {
    if (detailsRef.current) detailsRef.current.open = false;
    setOpen(false);
  }, []);

  const positionPopover = useCallback(() => {
    const summary = summaryRef.current;
    if (!summary || typeof window === "undefined") return;

    const rect = summary.getBoundingClientRect();
    const gutter = 10;
    const width = Math.min(360, Math.max(280, window.innerWidth - gutter * 2));
    const left = Math.min(
      Math.max(gutter, rect.right - width),
      Math.max(gutter, window.innerWidth - width - gutter),
    );
    const top = Math.max(gutter, rect.bottom + 10);

    setPopoverStyle({
      position: "fixed",
      top,
      left,
      right: "auto",
      width,
      maxHeight: `calc(100dvh - ${top + gutter}px)`,
      overflowY: "auto",
      zIndex: 100000,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    positionPopover();

    const onReposition = () => positionPopover();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (detailsRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      closeMenu();
    };

    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [closeMenu, open, positionPopover]);

  const popover = open ? (
    <div
      className="portal-account-menu__popover portal-account-menu__popover--overlay"
      ref={popoverRef}
      style={popoverStyle}
    >
      <div className="portal-account-menu__header">
        <span className="portal-account-menu__avatar portal-account-menu__avatar--large">
          {initials(profile.display_name)}
        </span>
        <div>
          <strong>{profile.display_name}</strong>
          <small>{profile.rank} · {profile.personnel_id}</small>
          {profile.is_test_account ? <b>Test account</b> : null}
        </div>
      </div>
      <div className="portal-account-menu__push">
        <BrowserPushControl />
      </div>
      <Link href="/portal/my-office" onClick={closeMenu}>My Info</Link>
      <Link href="/portal/account" onClick={closeMenu}>FiveM connection</Link>
      <PasswordChangeDialog
        triggerLabel="Change password"
        triggerClassName="portal-account-menu__action"
      />
      <PortalSignOut label="Sign out" />
    </div>
  ) : null;

  return (
    <>
      <details
        className="portal-account-menu"
        ref={detailsRef}
        onToggle={(event) => {
          const nextOpen = event.currentTarget.open;
          setOpen(nextOpen);
          if (nextOpen) window.requestAnimationFrame(positionPopover);
        }}
      >
        <summary aria-label="Open account menu" ref={summaryRef}>
          <span className="portal-account-menu__avatar">{initials(profile.display_name)}</span>
          <span className="portal-account-menu__identity">
            <strong>{profile.display_name}</strong>
            <small>{profile.call_sign ?? profile.personnel_id} · {profile.rank}</small>
          </span>
          <span className="portal-account-menu__chevron" aria-hidden="true">⌄</span>
        </summary>
      </details>
      {mounted && popover
        ? createPortal(popover, document.getElementById("lscso-portal-root") ?? document.body)
        : null}
    </>
  );
}
