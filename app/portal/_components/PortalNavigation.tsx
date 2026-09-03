"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const isCommand = ["Executive", "Command"].includes(profile.access_tier);
  const navigation = isCommand
    ? commandNavigation
    : ["Supervisor", "Preliminary"].includes(profile.access_tier)
      ? supervisorNavigation
      : deputyNavigation;

  const primaryMobile = isCommand
    ? navigation.filter((item) => ["overview", "personnel", "supervision", "training"].includes(item.id))
    : navigation;
  const secondaryMobile = isCommand
    ? navigation.filter((item) => !primaryMobile.includes(item))
    : [];
  const secondaryIsActive = secondaryMobile.some((item) => itemIsActive(item, active));

  useEffect(() => {
    setMobileMoreOpen(false);
  }, [pathname]);

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

      <nav className="portal-mobile-navigation portal-mobile-dock" aria-label={`${audience} mobile navigation`}>
        {primaryMobile.map((item) => {
          const isActive = itemIsActive(item, active);
          return <Link aria-label={item.mobileLabel} aria-current={isActive ? "page" : undefined} className={isActive ? "is-active" : undefined} href={item.href} key={`mobile-${item.id}-${item.href}`}><span className="portal-mobile-dock__icon"><PortalNavIcon id={item.id} /></span><small>{item.mobileLabel}</small></Link>;
        })}
        {secondaryMobile.length ? (
          <button aria-label="More portal navigation" className={secondaryIsActive ? "is-active" : undefined} onClick={() => setMobileMoreOpen(true)} type="button" aria-expanded={mobileMoreOpen}>
            <span className="portal-mobile-dock__icon"><PortalNavIcon id="more" /></span><small>More</small>
          </button>
        ) : null}
      </nav>

      {mobileMoreOpen ? (
        <div className="portal-mobile-more-backdrop portal-mobile-more-backdrop--dock" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setMobileMoreOpen(false);
        }}>
          <section className="portal-mobile-more" role="dialog" aria-modal="true" aria-label="More portal navigation">
            <div className="portal-mobile-more__heading"><div><span>LSCSO Portal</span><strong>More</strong></div><button onClick={() => setMobileMoreOpen(false)} type="button" aria-label="Close navigation">×</button></div>
            <nav>
              {secondaryMobile.map((item) => {
                const isActive = itemIsActive(item, active);
                return <Link className={isActive ? "is-active" : undefined} href={item.href} key={`more-${item.id}`} onClick={() => setMobileMoreOpen(false)}><span aria-hidden="true"><PortalNavIcon id={item.id} /></span><div><strong>{item.label}</strong><small>{item.section}</small></div></Link>;
              })}
            </nav>
          </section>
        </div>
      ) : null}

      <style>{`
        @media (max-width: 860px) {
          .portal-root .portal-content {
            padding-bottom: 188px !important;
          }

          .portal-root .portal-mobile-dock {
            position: fixed !important;
            z-index: 100 !important;
            left: 50% !important;
            right: auto !important;
            bottom: max(14px, env(safe-area-inset-bottom)) !important;
            width: min(calc(100vw - 28px), 480px) !important;
            min-height: 66px !important;
            transform: translateX(-50%) !important;
            display: grid !important;
            grid-template-columns: repeat(var(--portal-mobile-tabs, 5), minmax(0, 1fr)) !important;
            gap: 2px !important;
            padding: 7px 9px !important;
            border: 1px solid rgba(255, 255, 255, 0.16) !important;
            border-radius: 30px !important;
            background: rgba(25, 28, 31, 0.86) !important;
            box-shadow: 0 18px 55px rgba(0, 0, 0, 0.56), inset 0 1px 0 rgba(255,255,255,.05) !important;
            -webkit-backdrop-filter: blur(24px) saturate(135%) !important;
            backdrop-filter: blur(24px) saturate(135%) !important;
          }

          .portal-root .portal-mobile-dock > a,
          .portal-root .portal-mobile-dock > button {
            position: relative !important;
            min-width: 0 !important;
            min-height: 52px !important;
            display: grid !important;
            place-items: center !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 21px !important;
            background: transparent !important;
            color: rgba(242, 240, 233, 0.62) !important;
            box-shadow: none !important;
            text-decoration: none !important;
          }

          .portal-root .portal-mobile-dock > a::after,
          .portal-root .portal-mobile-dock > button::after {
            position: absolute;
            bottom: 2px;
            left: 50%;
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: transparent;
            content: "";
            transform: translateX(-50%);
          }

          .portal-root .portal-mobile-dock > a.is-active,
          .portal-root .portal-mobile-dock > button.is-active {
            background: rgba(197, 170, 90, 0.1) !important;
            color: var(--portal-gold-bright) !important;
          }

          .portal-root .portal-mobile-dock > a.is-active::after,
          .portal-root .portal-mobile-dock > button.is-active::after {
            background: var(--portal-gold-bright);
            box-shadow: 0 0 10px rgba(219, 197, 119, 0.5);
          }

          .portal-mobile-dock__icon {
            width: 31px !important;
            height: 31px !important;
            display: grid !important;
            place-items: center !important;
            border: 0 !important;
            background: transparent !important;
            color: inherit !important;
          }

          .portal-mobile-dock__icon svg {
            width: 26px;
            height: 26px;
          }

          .portal-root .portal-mobile-dock small {
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            margin: -1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
          }

          .portal-root .portal-mobile-more-backdrop--dock {
            padding-bottom: max(94px, calc(env(safe-area-inset-bottom) + 84px)) !important;
          }

          .portal-root .portal-mobile-more nav a > span {
            width: 40px !important;
            height: 40px !important;
          }

          .portal-root .portal-mobile-more nav a > span svg {
            width: 22px;
            height: 22px;
          }
        }

        @media (max-width: 860px) and (-webkit-min-device-pixel-ratio: 0) {
          .portal-root .portal-mobile-dock {
            bottom: calc(env(safe-area-inset-bottom) + 78px) !important;
          }
        }

        @media (max-width: 860px) and (display-mode: standalone) {
          .portal-root .portal-mobile-dock {
            bottom: max(14px, env(safe-area-inset-bottom)) !important;
          }
          .portal-root .portal-mobile-more-backdrop--dock {
            padding-bottom: max(18px, env(safe-area-inset-bottom)) !important;
          }
          .portal-root .portal-content {
            padding-bottom: 112px !important;
          }
        }
      `}</style>
    </>
  );
}
