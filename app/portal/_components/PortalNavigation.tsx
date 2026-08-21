"use client";

import Link from "next/link";
import { usePortalProfile } from "./PortalProfileProvider";

type ActivePortalView = "overview" | "personnel" | "guardians" | "record" | "approvals" | "activity" | "certifications" | "awards";

type PortalNavigationProps = {
  active: ActivePortalView;
  audience: "command" | "deputy";
};

const personalNavigation = [
  { id: "record", href: "/portal/personnel", label: "My Office", mobileLabel: "My Office", glyph: "MO" },
] as const;

const commandNavigation = [
  ...personalNavigation,
  { id: "overview", href: "/portal/command", label: "Command overview", mobileLabel: "Overview", glyph: "CO" },
  { id: "personnel", href: "/portal/command/personnel", label: "Personnel roster", mobileLabel: "Roster", glyph: "PR" },
  { id: "guardians", href: "/portal/command/guardians", label: "Guardian center", mobileLabel: "Guardians", glyph: "GC" },
  { id: "certifications", href: "/portal/command/certifications", label: "Certifications", mobileLabel: "Certs", glyph: "CE" },
  { id: "approvals", href: "/portal/command/approvals", label: "Approvals", mobileLabel: "Approvals", glyph: "AP" },
  { id: "activity", href: "/portal/command/activity", label: "Activity & audit", mobileLabel: "Activity", glyph: "AA" },
] as const;

const supervisorNavigation = [
  ...personalNavigation,
  { id: "guardians", href: "/portal/command/guardians", label: "Guardian center", mobileLabel: "Guardians", glyph: "GC" },
  { id: "certifications", href: "/portal/command/certifications", label: "Certification requests", mobileLabel: "Certs", glyph: "CE" },
] as const;

const deputyNavigation = [
  ...personalNavigation,
  { id: "certifications", href: "/portal/personnel#certifications", label: "Certifications", mobileLabel: "Certs", glyph: "CE" },
  { id: "awards", href: "/portal/personnel#awards", label: "Medals & awards", mobileLabel: "Awards", glyph: "AW" },
  { id: "guardians", href: "/portal/personnel#guardians", label: "My Guardians", mobileLabel: "Guardians", glyph: "MG" },
  { id: "requests", href: "/portal/personnel#requests", label: "Requests & LOA", mobileLabel: "Requests", glyph: "RQ" },
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
            <Link aria-current={isActive ? "page" : undefined} className={isActive ? "is-active" : undefined} href={item.href} key={`${item.id}-${item.href}`}>
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
            <Link aria-current={isActive ? "page" : undefined} className={isActive ? "is-active" : undefined} href={item.href} key={`mobile-${item.id}-${item.href}`}>
              <span aria-hidden="true">{item.glyph}</span>
              <small>{item.mobileLabel}</small>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
