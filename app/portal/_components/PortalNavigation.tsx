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
  | "awards"
  | "notifications"
  | "applications"
  | "psa";

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

type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

const myInfo: NavigationItem = {
  id: "record",
  href: "/portal/my-office",
  label: "My Info",
  mobileLabel: "My Info",
  glyph: "MI",
  personal: true,
};

const commandSections: NavigationSection[] = [
  {
    label: "Command",
    items: [
      { id: "overview", href: "/portal/command/home", label: "Home", mobileLabel: "Home", glyph: "HM" },
      { id: "personnel", href: "/portal/command/personnel", label: "Personnel", mobileLabel: "Personnel", glyph: "PR", matches: ["awards"] },
      { id: "supervision", href: "/portal/command/supervision", label: "Supervision", mobileLabel: "Supervise", glyph: "SV", matches: ["guardians"] },
      { id: "training", href: "/portal/command/training", label: "Training", mobileLabel: "Training", glyph: "TR", matches: ["certifications"] },
    ],
  },
  {
    label: "Department",
    items: [
      { id: "applications", href: "/portal/command/applications", label: "Applications", mobileLabel: "Apply", glyph: "AP" },
      { id: "psa", href: "/portal/command/psa", label: "Public PSA", mobileLabel: "PSA", glyph: "PS" },
    ],
  },
  {
    label: "Administration",
    items: [
      { id: "administration", href: "/portal/command/administration", label: "Administration", mobileLabel: "Admin", glyph: "AD", matches: ["approvals", "activity"] },
    ],
  },
  { label: "Personal", items: [myInfo] },
];

const supervisorSections: NavigationSection[] = [
  {
    label: "Operations",
    items: [
      { id: "supervision", href: "/portal/command/supervision", label: "My Personnel & Supervision", mobileLabel: "Supervise", glyph: "SV", matches: ["guardians"] },
      { id: "approvals", href: "/portal/command/approvals", label: "Assigned Requests", mobileLabel: "Requests", glyph: "RQ" },
      { id: "training", href: "/portal/command/training", label: "Training", mobileLabel: "Training", glyph: "TR", matches: ["certifications"] },
    ],
  },
  { label: "Personal", items: [myInfo] },
];

const deputySections: NavigationSection[] = [
  {
    label: "My Personnel File",
    items: [
      myInfo,
      { id: "certifications", href: "/portal/my-office#certifications", label: "Certifications", mobileLabel: "Certs", glyph: "CE" },
      { id: "awards", href: "/portal/my-office#awards", label: "Medals & awards", mobileLabel: "Awards", glyph: "AW" },
      { id: "guardians", href: "/portal/my-office#documents", label: "My Documents", mobileLabel: "Documents", glyph: "MD" },
      { id: "requests", href: "/portal/my-office#requests", label: "Requests & LOA", mobileLabel: "Requests", glyph: "RQ" },
    ],
  },
];

function itemIsActive(item: NavigationItem, active: ActivePortalView) {
  return item.id === active || item.matches?.includes(active) === true;
}

export function PortalNavigation({ active, audience }: PortalNavigationProps) {
  const profile = usePortalProfile();
  const sections = ["Executive", "Command"].includes(profile.access_tier)
    ? commandSections
    : ["Supervisor", "Preliminary"].includes(profile.access_tier)
      ? supervisorSections
      : deputySections;
  const mobileItems = sections.flatMap((section) => section.items);

  return (
    <>
      <nav className="portal-navigation" aria-label={`${audience} portal navigation`}>
        {sections.map((section) => (
          <div className="portal-navigation-section" key={section.label}>
            <small>{section.label}</small>
            <div>
              {section.items.map((item) => {
                const isActive = itemIsActive(item, active);
                const className = [isActive ? "is-active" : "", item.personal ? "is-personal-navigation" : ""]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <Link aria-current={isActive ? "page" : undefined} className={className || undefined} href={item.href} key={`${item.id}-${item.href}`}>
                    <span aria-hidden="true">{item.glyph}</span>
                    <b>{item.label}</b>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <nav className="portal-mobile-navigation" aria-label={`${audience} mobile navigation`}>
        {mobileItems.map((item) => {
          const isActive = itemIsActive(item, active);
          return <Link aria-current={isActive ? "page" : undefined} className={isActive ? "is-active" : undefined} href={item.href} key={`mobile-${item.id}-${item.href}`}><span aria-hidden="true">{item.glyph}</span><small>{item.mobileLabel}</small></Link>;
        })}
      </nav>
    </>
  );
}
