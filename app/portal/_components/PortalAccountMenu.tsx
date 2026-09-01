"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PasswordChangeDialog } from "./PasswordChangeDialog";
import { PortalSignOut } from "./PortalSignOut";
import { usePortalProfile } from "./PortalProfileProvider";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function PortalAccountMenu() {
  const profile = usePortalProfile();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="portal-account-menu" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="portal-account-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{initials(profile.display_name)}</span>
        <div>
          <strong>{profile.display_name}</strong>
          <small>{profile.call_sign ?? "No call sign"} · {profile.rank}</small>
        </div>
        <b aria-hidden="true">⌄</b>
      </button>

      {open ? (
        <div className="portal-account-dropdown" role="menu">
          <div className="portal-account-dropdown-head">
            <span>{profile.access_tier}</span>
            <strong>{profile.display_name}</strong>
            <small>{profile.personnel_id}{profile.is_test_account ? " · Test account" : ""}</small>
          </div>
          <Link href="/portal/my-office" onClick={() => setOpen(false)} role="menuitem">My Info</Link>
          <PasswordChangeDialog
            onTrigger={() => setOpen(false)}
            triggerClassName="portal-account-menu-action"
            triggerLabel="Change password"
          />
          <PortalSignOut className="portal-account-menu-action portal-account-menu-action--danger" label="Sign out" />
        </div>
      ) : null}
    </div>
  );
}
