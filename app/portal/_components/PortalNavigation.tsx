"use client";

import Link from "next/link";
import { usePortalProfile } from "./PortalProfileProvider";

type ActivePortalView = "overview" | "personnel" | "guardians" | "record";

type PortalNavigationProps = {
  active: ActivePortalView;
  audience: "command" | "deputy";
};

const commandNavigation = [
  { id: "overview", href: "/portal/command", label: "Command overview", mobileLabel: "Overview", glyph: "CO" },
  { id: "personnel", href: "/portal/command/personnel", label: "Personnel roster", mobileLabel: "Roster", glyph: "PR" },
  { id: "guardians", href: "/portal/command/guardians", label: "Guardian center", mobileLabel: "Guardians", glyph: "GC" },
  { id: "approvals", href: "/portal/command#approvals", label: "Approvals", mobileLabel: "Approvals", glyph: "AP" },
  { id: "activity", href: "/portal/command#notifications", label: "Recent activity", mobileLabel: "Activity", glyph: "RA" },
] as const;

const supervisorNavigation = [
  { id: "guardians", href: "/portal/command/guardians", label: "Guardian center", mobileLabel: "Guardians", glyph: "GC" },
] as const;

const deputyNavigation = [
  { id: "record", href: "/portal/personnel", label: "My record", mobileLabel: "Record", glyph: "MR" },
  { id: "certifications", href: "/portal/personnel#certifications", label: "Certifications", mobileLabel: "Certs", glyph: "CE" },
  { id: "assignments", href: "/portal/personnel#assignments", label: "Assignments", mobileLabel: "Assignments", glyph: "AS" },
  { id: "guardians", href: "/portal/personnel#guardians", label: "My Guardians", mobileLabel: "Guardians", glyph: "MG" },
  { id: "requests", href: "/portal/personnel#requests", label: "Requests", mobileLabel: "Requests", glyph: "RQ" },
] as const;

export function PortalNavigation({ active, audience }: PortalNavigationProps) {
  const profile = usePortalProfile();
  const navigation = audience === "deputy"
    ? deputyNavigation
    : ["Executive", "Command"].includes(profile.access_tier)
      ? commandNavigation
      : supervisorNavigation;

  return (
    <>
      <nav className="portal-navigation" aria-label={`${audience} portal navigation`}>
        {navigation.map((item) => {
          const isActive = item.id === active;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "is-active" : undefined}
              href={item.href}
              key={`${item.id}-${item.href}`}
            >
              <span aria-hidden="true">{item.glyph}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav className="portal-mobile-navigation" aria-label={`${audience} mobile navigation`}>
        {navigation.map((item) => {
          const isActive = item.id === active;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "is-active" : undefined}
              href={item.href}
              key={`mobile-${item.id}-${item.href}`}
            >
              <span aria-hidden="true">{item.glyph}</span>
              <small>{item.mobileLabel}</small>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
