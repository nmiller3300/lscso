"use client";

import Link from "next/link";
import { usePortalProfile } from "./PortalProfileProvider";
import { PasswordChangeDialog } from "./PasswordChangeDialog";
import { PortalSignOut } from "./PortalSignOut";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function PortalAccountMenu() {
  const profile = usePortalProfile();

  return (
    <details className="portal-account-menu">
      <summary aria-label="Open account menu">
        <span className="portal-account-menu__avatar">{initials(profile.display_name)}</span>
        <span className="portal-account-menu__identity">
          <strong>{profile.display_name}</strong>
          <small>{profile.call_sign ?? profile.personnel_id} · {profile.rank}</small>
        </span>
        <span className="portal-account-menu__chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="portal-account-menu__popover">
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
        <Link href="/portal/my-office">My Info</Link>
        <Link href="/portal/account">FiveM connection</Link>
        <PasswordChangeDialog
          triggerLabel="Change password"
          triggerClassName="portal-account-menu__action"
        />
        <PortalSignOut label="Sign out" />
      </div>
    </details>
  );
}
