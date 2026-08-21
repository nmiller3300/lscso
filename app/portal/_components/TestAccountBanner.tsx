"use client";

import { usePortalProfile } from "./PortalProfileProvider";

export function TestAccountBanner() {
  const profile = usePortalProfile();
  if (!profile.is_test_account) return null;

  return (
    <section className="portal-test-account-banner" role="note">
      <span>Test account</span>
      <div>
        <strong>This personnel record is reserved for workflow testing.</strong>
        <p>Guardians, acknowledgments, requests, assignments, and certification actions here are excluded from official personnel reporting.</p>
      </div>
    </section>
  );
}
