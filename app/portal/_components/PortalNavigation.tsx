"use client";

import Link from "next/link";
import { usePortalProfile } from "./PortalProfileProvider";

type ActivePortalView =
  | "overview"
  | "personnel"
  | "supervision"
  | "training"
  | "administration"
  | "guardians"
  | "record"
  | "approvals"
  | "activity"
  | "certifications"
  | "awards";

type PortalNavigationProps = {
  active: ActivePortalView;
  audience: "command" | "deputy";
};

type NavigationItem = {
  id: ActivePortalView | "requests";
  href: string;
  label: string;
  mobileLabel: string;
  glyph: string;
  personal?: boolean;
  matches?: ActivePortalView[];
};

const myInfo: NavigationItem = {
  id: "record",
  href: "/portal/my-office",
  label: "My Info",
  mobileLabel: "My Info",
  glyph: "MI",
  personal: true,
};

const commandNavigation: NavigationItem[] = [
  myInfo,
  { id: "overview", href: "/portal/command", label: "Home", mobileLabel: "Home", glyph: "HM" },
  { id: "personnel", href: "/portal/command/personnel", label: "Personnel", mobileLabel: "Personnel", glyph: "PR", matches: ["awards"] },
  { id: "supervision", href: "/portal/command/supervision", label: "Supervision", mobileLabel: "Supervise", glyph: "SV", matches: ["guardians"] },
  { id: "training", href: "/portal/command/training", label: "Training", mobileLabel: "Training", glyph: "TR", matches: ["certifications"] },
  { id: "administration", href: "/portal/command/administration", label: "Administration", mobileLabel: "Admin", glyph: "AD", matches: ["approvals", "activity"] },
];

const supervisorNavigation: NavigationItem[] = [
  myInfo,
  { id: "supervision", href: "/portal/command/supervision", label: "My Personnel & Supervision", mobileLabel: "Supervise", glyph: "SV", matches: ["guardians"] },
  { id: "training", href: "/portal/command/training", label: "Training", mobileLabel: "Training", glyph: "TR", matches: ["certifications"] },
];

const deputyNavigation: NavigationItem[] = [
  myInfo,
  { id: "certifications", href: "/portal/my-office#certifications", label: "Certifications", mobileLabel: "Certs", glyph: "CE" },
  { id: "awards", href: "/portal/my-office#awards", label: "Medals & awards", mobileLabel: "Awards", glyph: "AW" },
  { id: "guardians", href: "/portal/my-office#guardians", label: "My Guardians", mobileLabel: "Guardians", glyph: "MG" },
  { id: "requests", href: "/portal/my-office#requests", label: "Requests & LOA", mobileLabel: "Requests", glyph: "RQ" },
];

function itemIsActive(item: NavigationItem, active: ActivePortalView) {
  return item.id === active || item.matches?.includes(active) === true;
}

export function PortalNavigation({ active, audience }: PortalNavigationProps) {
  const profile = usePortalProfile();
  const navigation = ["Executive", "Command"].includes(profile.access_tier)
    ? commandNavigation
    : ["Supervisor", "Preliminary"].includes(profile.access_tier)
      ? supervisorNavigation
      : deputyNavigation;

  return (
    <>
      <nav className="portal-navigation" aria-label={`${audience} portal navigation`}>
        {navigation.map((item) => {
          const isActive = itemIsActive(item, active);
          const className = [isActive ? "is-active" : "", item.personal ? "is-personal-navigation" : ""]
            .filter(Boolean)
            .join(" ");
          return <Link aria-current={isActive ? "page" : undefined} className={className || undefined} href={item.href} key={`${item.id}-${item.href}`}><span aria-hidden="true">{item.glyph}</span>{item.label}</Link>;
        })}
      </nav>
      <nav className="portal-mobile-navigation" aria-label={`${audience} mobile navigation`}>
        {navigation.map((item) => {
          const isActive = itemIsActive(item, active);
          return <Link aria-current={isActive ? "page" : undefined} className={isActive ? "is-active" : undefined} href={item.href} key={`mobile-${item.id}-${item.href}`}><span aria-hidden="true">{item.glyph}</span><small>{item.mobileLabel}</small></Link>;
        })}
      </nav>
    </>
  );
}
