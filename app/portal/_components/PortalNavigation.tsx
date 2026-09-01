"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  section: string;
  personal?: boolean;
  matches?: ActivePortalView[];
};

const myInfo: NavigationItem = {
  id: "record",
  href: "/portal/my-office",
  label: "My Info",
  mobileLabel: "My Info",
  glyph: "MI",
  section: "Personal",
  personal: true,
};

const commandNavigation: NavigationItem[] = [
  { id: "overview", href: "/portal/command/home", label: "Home", mobileLabel: "Home", glyph: "HM", section: "Command" },
  { id: "personnel", href: "/portal/command/personnel", label: "Personnel", mobileLabel: "Personnel", glyph: "PR", section: "Command", matches: ["awards"] },
  { id: "supervision", href: "/portal/command/supervision", label: "Supervision", mobileLabel: "Supervise", glyph: "SV", section: "Command", matches: ["guardians"] },
  { id: "training", href: "/portal/command/training", label: "Training", mobileLabel: "Training", glyph: "TR", section: "Command", matches: ["certifications"] },
  { id: "applications", href: "/portal/command/applications", label: "Applications", mobileLabel: "Applications", glyph: "AP", section: "Department" },
  { id: "psa", href: "/portal/command/psa", label: "Public PSA", mobileLabel: "Public PSA", glyph: "PS", section: "Department" },
  { id: "administration", href: "/portal/command/administration", label: "Administration", mobileLabel: "Admin", glyph: "AD", section: "Administration", matches: ["approvals", "activity"] },
  myInfo,
];

const supervisorNavigation: NavigationItem[] = [
  { id: "supervision", href: "/portal/command/supervision", label: "My Personnel & Supervision", mobileLabel: "Supervise", glyph: "SV", section: "Work", matches: ["guardians"] },
  { id: "approvals", href: "/portal/command/approvals", label: "Assigned Requests", mobileLabel: "Requests", glyph: "RQ", section: "Work" },
  { id: "training", href: "/portal/command/training", label: "Training", mobileLabel: "Training", glyph: "TR", section: "Work", matches: ["certifications"] },
  myInfo,
];

const deputyNavigation: NavigationItem[] = [
  myInfo,
  { id: "certifications", href: "/portal/my-office#certifications", label: "Certifications", mobileLabel: "Certs", glyph: "CE", section: "Personnel" },
  { id: "awards", href: "/portal/my-office#awards", label: "Medals & awards", mobileLabel: "Awards", glyph: "AW", section: "Personnel" },
  { id: "guardians", href: "/portal/my-office#documents", label: "My Documents", mobileLabel: "Documents", glyph: "MD", section: "Personnel" },
  { id: "requests", href: "/portal/my-office#requests", label: "Requests & LOA", mobileLabel: "Requests", glyph: "RQ", section: "Personnel" },
];

function itemIsActive(item: NavigationItem, active: ActivePortalView) {
  return item.id === active || item.matches?.includes(active) === true;
}

function DesktopNavigation({ navigation, active }: { navigation: NavigationItem[]; active: ActivePortalView }) {
  const sections = Array.from(new Set(navigation.map((item) => item.section)));
  return (
    <nav className="portal-navigation" aria-label="Portal navigation">
      {sections.map((section) => (
        <div className="portal-navigation-group" key={section}>
          <span className="portal-navigation-group__label">{section}</span>
          {navigation.filter((item) => item.section === section).map((item) => {
            const isActive = itemIsActive(item, active);
            const className = [isActive ? "is-active" : "", item.personal ? "is-personal-navigation" : ""]
              .filter(Boolean)
              .join(" ");
            return <Link aria-current={isActive ? "page" : undefined} className={className || undefined} href={item.href} key={`${item.id}-${item.href}`}><span aria-hidden="true">{item.glyph}</span>{item.label}</Link>;
          })}
        </div>
      ))}
    </nav>
  );
}

export function PortalNavigation({ active, audience }: PortalNavigationProps) {
  const profile = usePortalProfile();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const isCommand = ["Executive", "Command"].includes(profile.access_tier);
  const navigation = isCommand
    ? commandNavigation
    : ["Supervisor", "Preliminary"].includes(profile.access_tier)
      ? supervisorNavigation
      : deputyNavigation;

  const primaryMobile = isCommand
    ? navigation.filter((item) => ["overview", "personnel", "supervision", "training", "record"].includes(item.id))
    : navigation;
  const secondaryMobile = isCommand
    ? navigation.filter((item) => !primaryMobile.includes(item))
    : [];
  const secondaryIsActive = secondaryMobile.some((item) => itemIsActive(item, active));

  useEffect(() => {
    if (!mobileMoreOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMoreOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMoreOpen]);

  return (
    <>
      <DesktopNavigation navigation={navigation} active={active} />

      <nav className="portal-mobile-navigation" aria-label={`${audience} mobile navigation`}>
        {primaryMobile.map((item) => {
          const isActive = itemIsActive(item, active);
          return <Link aria-current={isActive ? "page" : undefined} className={isActive ? "is-active" : undefined} href={item.href} key={`mobile-${item.id}-${item.href}`}><span aria-hidden="true">{item.glyph}</span><small>{item.mobileLabel}</small></Link>;
        })}
        {secondaryMobile.length ? (
          <button className={secondaryIsActive ? "is-active" : undefined} onClick={() => setMobileMoreOpen(true)} type="button" aria-expanded={mobileMoreOpen}>
            <span aria-hidden="true">•••</span><small>More</small>
          </button>
        ) : null}
      </nav>

      {mobileMoreOpen ? (
        <div className="portal-mobile-more-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setMobileMoreOpen(false);
        }}>
          <section className="portal-mobile-more" role="dialog" aria-modal="true" aria-label="More portal navigation">
            <div className="portal-mobile-more__heading"><div><span>LSCSO Portal</span><strong>More</strong></div><button onClick={() => setMobileMoreOpen(false)} type="button" aria-label="Close navigation">×</button></div>
            <nav>
              {secondaryMobile.map((item) => {
                const isActive = itemIsActive(item, active);
                return <Link className={isActive ? "is-active" : undefined} href={item.href} key={`more-${item.id}`} onClick={() => setMobileMoreOpen(false)}><span aria-hidden="true">{item.glyph}</span><div><strong>{item.label}</strong><small>{item.section}</small></div></Link>;
              })}
            </nav>
          </section>
        </div>
      ) : null}
    </>
  );
}
