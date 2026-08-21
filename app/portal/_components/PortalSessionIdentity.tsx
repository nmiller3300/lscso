"use client";

import { usePortalProfile } from "./PortalProfileProvider";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function PortalSessionIdentity() {
  const profile = usePortalProfile();
  return (
    <div className="portal-session-identity">
      <span>{initials(profile.display_name)}</span>
      <div>
        <strong>{profile.display_name}</strong>
        <small>{profile.call_sign ?? "No call sign"} · {profile.rank}</small>
        {profile.is_test_account ? <b>Test account</b> : null}
      </div>
    </div>
  );
}
