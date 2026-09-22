"use client";

import Link from "next/link";
import { usePortalProfile } from "./PortalProfileProvider";

export function HiringAuthorityShortcut({ compact = false }: { compact?: boolean }) {
  const profile = usePortalProfile();
  const standardCommand = ["Executive", "Command"].includes(profile.access_tier);
  if (!profile.hiring_authority || standardCommand) return null;

  return (
    <Link
      className={compact ? "portal-button portal-button--secondary" : "portal-button portal-button--primary"}
      href="/portal/command/applications"
      title="Delegated Hiring Administration"
    >
      Recruitment
    </Link>
  );
}
