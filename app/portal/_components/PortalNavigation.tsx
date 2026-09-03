"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  detail: string;
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
  detail: "Your record, requests, documents, and certifications",
  personal: true,
};

const commandNavigation: NavigationItem[] = [
  { id: "overview", href: "/portal/command/home", label: "Home", mobileLabel: "Home", glyph: "HM", section: "Command", detail: "Command overview and priority work" },
  { id: "personnel", href: "/portal/command/personnel", label: "Personnel", mobileLabel: "Personnel", glyph: "PR", section: "Command", detail: "Personnel records, standing, and assignments", matches: ["awards"] },
  { id: "supervision", href: "/portal/command/supervision", label: "Supervision", mobileLabel: "Supervise", glyph: "SV", section: "Command", detail: "Guardians, oversight, and follow-up", matches: ["guardians"] },
  { id: "training", href: "/portal/command/training", label: "Training", mobileLabel: "Training", glyph: "TR", section: "Command", detail: "FTO, progression, and qualifications", matches: ["certifications"] },
  { id: "applications", href: "/portal/command/applications", label: "Applications", mobileLabel: "Applications", glyph: "AP", section: "Department", detail: "Recruitment applications and hiring review" },
  { id: "psa", href: "/portal/command/psa", label: "Public PSA", mobileLabel: "Public PSA", glyph: "PS", section: "Department", detail: "Public information and department notices" },
  { id: "administration", href: "/portal/command/administration", label: "Administration", mobileLabel: "Admin", glyph: "AD", section: "Administration", detail: "Approvals, audit, accounts, and structure", matches: ["approvals", "activity"] },
  myInfo,
];

const supervisorNavigation: NavigationItem[] = [
  { id: "supervision", href: "/portal/command/supervision", label: "My Personnel & Supervision", mobileLabel: "Supervise", glyph: "SV", section: "Work", detail: "Assigned personnel, Guardians, and follow-up", matches: ["guardians"] },
  { id: "approvals", href: "/portal/command/approvals", label: "Assigned Requests", mobileLabel: "Requests", glyph: "RQ", section: "Work", detail: "Requests routed to your authority" },
  { id: "training", href: "/portal/command/training", label: "Training", mobileLabel: "Training", glyph: "TR", section: "Work", detail: "Training progress and qualifications", matches: ["certifications"] },
  myInfo,
];

const deputyNavigation: NavigationItem[] = [
  myInfo,
  { id: "certifications", href: "/portal/my-office#certifications", label: "Certifications", mobileLabel: "Certs", glyph: "CE", section: "Personnel", detail: "Current and requested certifications" },
  { id: "awards", href: "/portal/my-office#awards", label: "Medals & awards", mobileLabel: "Awards", glyph: "AW", section: "Personnel", detail: "Recognition and department awards" },
  { id: "guardians", href: "/portal/my-office#documents", label: "My Documents", mobileLabel: "Documents", glyph: "MD", section: "Personnel", detail: "Personnel documents and acknowledgements" },
  { id: "requests", href: "/portal/my-office#requests", label: "Requests & LOA", mobileLabel: "Requests", glyph: "RQ", section: "Personnel", detail: "Personnel requests and leave of absence" },
];

function itemIsActive(item: NavigationItem, active: ActivePortalView) {
  return item.id === active || item.matches?.includes(active) === true;
}

function PortalNavIcon({ id }: { id: NavigationItem["id"] | "more" }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (id === "overview") return <svg {...common}><path d="M3.5 10.8 12 3.8l8.5 7"/><path d="M5.8 9.7v10h12.4v-10"/><path d="M9.5 19.7v-6h5v6"/></svg>;
  if (id === "personnel" || id === "record") return <svg {...common}><circle cx="12" cy="8" r="3.3"/><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6"/></svg>;
  if (id === "supervision" || id === "guardians") return <svg {...common}><path d="M12 3.2 19 6v5.2c0 4.6-2.8 7.7-7 9.6-4.2-1.9-7-5-7-9.6V6l7-2.8Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (id === "training" || id === "certifications") return <svg {...common}><path d="m3.5 8.5 8.5-4 8.5 4-8.5 4-8.5-4Z"/><path d="M7 10.2v4.3c2.8 2.1 7.2 2.1 10 0v-4.3"/><path d="M20.5 8.5v5"/></svg>;
  if (id === "applications") return <svg {...common}><path d="M7 3.8h7l4 4V20H7z"/><path d="M14 3.8V8h4"/><path d="M10 12h5M10 15.5h5"/></svg>;
  if (id === "psa") return <svg {...common}><path d="M4 11v2h3l7 4V7l-7 4H4Z"/><path d="M17 9.2c1.5 1.5 1.5 4.1 0 5.6"/></svg>;
  if (id === "administration" || id === "approvals" || id === "activity") return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="1.8" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="11" cy="17" r="1.8" fill="currentColor" stroke="none"/></svg>;
  if (id === "awards") return <svg {...common}><circle cx="12" cy="9" r="4.4"/><path d="m9.2 12.5-1 7 3.8-2 3.8 2-1-7"/></svg>;
  if (id === "requests") return <svg {...common}><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>;
  return <svg {...common}><circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.25" fill="currentColor" stroke="none"/></svg>;
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
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCommand = ["Executive", "Command"].includes(profile.access_tier);
  const navigation = isCommand
    ? commandNavigation
    : ["Supervisor", "Preliminary"].includes(profile.access_tier)
      ? supervisorNavigation
      : deputyNavigation;
  const sections = Array.from(new Set(navigation.map((item) => item.section)));
  const workspaceLabel = isCommand
    ? "Command Operations"
    : ["Supervisor", "Preliminary"].includes(profile.access_tier)
      ? "Supervisor Workspace"
      : "Personnel Workspace";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    };

    const closeAtDesktopWidth = () => {
      if (window.innerWidth > 860) setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeAtDesktopWidth);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeAtDesktopWidth);
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <DesktopNavigation navigation={navigation} active={active} />

      <button
        ref={triggerRef}
        className="portal-mobile-menu-trigger"
        onClick={() => setMobileMenuOpen(true)}
        type="button"
        aria-expanded={mobileMenuOpen}
        aria-label="Open portal navigation"
      >
        <span className="portal-mobile-menu-trigger__icon" aria-hidden="true"><i /><i /><i /></span>
        <span className="portal-sr-only">Menu</span>
      </button>

      {mobileMenuOpen ? (
        <div className="portal-mobile-menu-backdrop">
          <section className="portal-mobile-menu-drawer" role="dialog" aria-modal="true" aria-label="Portal navigation menu">
            <header className="portal-mobile-menu-header">
              <div className="portal-mobile-menu-brand">
                <span aria-hidden="true">LS</span>
                <div><small>Los Santos County Sheriff&apos;s Office</small><strong>Personnel Operations</strong></div>
              </div>
              <button
                className="portal-mobile-menu-close"
                onClick={() => {
                  setMobileMenuOpen(false);
                  requestAnimationFrame(() => triggerRef.current?.focus());
                }}
                type="button"
                aria-label="Close portal navigation"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="portal-mobile-menu-intro">
              <span>Internal personnel network</span>
              <h2>{workspaceLabel}</h2>
              <p>Move through personnel records, department operations, requests, training, and your account without leaving the secure portal.</p>
            </div>

            <nav className="portal-mobile-menu-groups" aria-label={`${audience} portal navigation`}>
              {sections.map((section) => (
                <div className="portal-mobile-menu-group" key={`mobile-group-${section}`}>
                  <span className="portal-mobile-menu-group__label">{section}</span>
                  <div>
                    {navigation.filter((item) => item.section === section).map((item) => {
                      const isActive = itemIsActive(item, active);
                      return (
                        <Link
                          aria-current={isActive ? "page" : undefined}
                          className={isActive ? "is-active" : undefined}
                          href={item.href}
                          key={`mobile-drawer-${item.id}-${item.href}`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <span className="portal-mobile-menu-glyph" aria-hidden="true"><PortalNavIcon id={item.id} /></span>
                          <div><strong>{item.label}</strong><small>{item.detail}</small></div>
                          <b aria-hidden="true">→</b>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <footer className="portal-mobile-menu-footer">
              <Link href="/" onClick={() => setMobileMenuOpen(false)}><span>Return to public website</span><b aria-hidden="true">→</b></Link>
              <div><span className="portal-security-pulse" aria-hidden="true" /><small>Restricted LSCSO personnel system</small></div>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
