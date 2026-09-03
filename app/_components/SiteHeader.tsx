"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const divisions = [
  { href: "/patrol", label: "Patrol", detail: "Primary field operations" },
  { href: "/internal-affairs", label: "Internal Affairs", detail: "Standards & accountability" },
  { href: "/training-recruitment", label: "Training & Recruitment", detail: "Development & hiring" },
];

const mobilePrimaryNavigation = [
  { href: "/", label: "Home", detail: "LSCSO overview" },
  { href: "/about", label: "About", detail: "Mission, values & service" },
  { href: "/office-of-the-sheriff", label: "Office of the Sheriff", detail: "Executive leadership" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const mobileNavigationRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (mobileNavigationRef.current) mobileNavigationRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const navigation = mobileNavigationRef.current;
    if (!navigation) return;

    const previousOverflow = document.body.style.overflow;

    const syncScrollLock = () => {
      document.body.style.overflow = navigation.open ? "hidden" : previousOverflow;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !navigation.open) return;
      navigation.open = false;
      navigation.querySelector<HTMLElement>(":scope > summary")?.focus();
    };

    navigation.addEventListener("toggle", syncScrollLock);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      navigation.removeEventListener("toggle", syncScrollLock);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="site-shell utility-content">
          <span>Los Santos County, San Andreas</span>
          <span>Established 1963</span>
        </div>
      </div>

      <div className="site-shell nav-shell refined-nav-shell">
        <Link className="site-brand refined-site-brand" href="/" aria-label="LSCSO homepage">
          <Image src="/images/lscso-patch-color.png" alt="" width={72} height={72} priority />
          <span>
            <strong>LSCSO</strong>
            <small>Los Santos County Sheriff</small>
          </span>
        </Link>

        <nav className="desktop-navigation refined-desktop-navigation" aria-label="Primary navigation">
          <Link href="/about">About</Link>
          <Link href="/office-of-the-sheriff">Office of the Sheriff</Link>

          <details className="division-menu">
            <summary>
              <span>Divisions</span>
              <span className="division-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="division-dropdown">
              <div className="division-dropdown-heading">
                <small>Operations</small>
                <strong>Department Divisions</strong>
              </div>
              {divisions.map((division) => (
                <Link href={division.href} key={division.href}>
                  <span>{division.label}</span>
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </details>

          <Link href="/join">Join LSCSO</Link>
          <Link href="/portal">Personnel Portal</Link>
        </nav>

        <details className="mobile-navigation" ref={mobileNavigationRef}>
          <summary aria-label="Toggle site navigation">
            <span />
            <span />
            <span />
          </summary>

          <nav aria-label="Mobile navigation">
            <div className="mobile-navigation__intro">
              <span>Los Santos County Sheriff&apos;s Office</span>
              <strong>Navigation</strong>
              <p>Public information, department operations, recruitment, and personnel access.</p>
            </div>

            <div className="mobile-navigation__primary">
              {mobilePrimaryNavigation.map((item, index) => (
                <Link href={item.href} key={item.href}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>

            <details className="mobile-division-menu">
              <summary>
                <div>
                  <small>Operations</small>
                  <strong>Department Divisions</strong>
                </div>
                <span aria-hidden="true">+</span>
              </summary>
              <div>
                {divisions.map((division) => (
                  <Link href={division.href} key={division.href}>
                    <span>{division.label}</span>
                    <small>{division.detail}</small>
                    <b aria-hidden="true">→</b>
                  </Link>
                ))}
              </div>
            </details>

            <div className="mobile-navigation__actions">
              <Link className="mobile-navigation__join" href="/join">
                <span><small>Recruitment</small><strong>Join LSCSO</strong></span>
                <b aria-hidden="true">→</b>
              </Link>
              <Link className="mobile-navigation__portal" href="/portal">
                <span><small>Authorized personnel</small><strong>Personnel Portal</strong></span>
                <b aria-hidden="true">→</b>
              </Link>
            </div>

            <footer className="mobile-navigation__footer">
              <span>Driven to Protect. Dedicated to Serve.</span>
              <small>Established 1963 · Los Santos County</small>
            </footer>
          </nav>
        </details>
      </div>

      <style>{`
        @media (min-width: 1061px) {
          .refined-nav-shell {
            height: 92px;
            gap: 34px;
          }

          .refined-site-brand {
            min-width: 250px;
          }

          .refined-site-brand img {
            width: 64px;
            height: 64px;
          }

          .refined-site-brand strong {
            font-size: 23px;
            letter-spacing: 0.15em;
          }

          .refined-site-brand small {
            font-size: 9px;
            letter-spacing: 0.12em;
            white-space: nowrap;
          }

          .refined-desktop-navigation {
            flex: 1 1 auto;
            justify-content: flex-end;
            gap: clamp(18px, 1.55vw, 28px);
            font-size: 11px;
            letter-spacing: 0.065em;
          }

          .refined-desktop-navigation > a,
          .division-menu > summary {
            flex: 0 0 auto;
            white-space: nowrap;
            padding-block: 14px;
          }

          .division-menu {
            position: relative;
          }

          .division-menu > summary {
            display: flex;
            align-items: center;
            gap: 7px;
            color: rgba(255, 255, 255, 0.78);
            cursor: pointer;
            list-style: none;
            transition: color 180ms ease;
          }

          .division-menu > summary::-webkit-details-marker {
            display: none;
          }

          .division-menu > summary:hover,
          .division-menu > summary:focus-visible,
          .division-menu[open] > summary {
            color: var(--white);
          }

          .division-chevron {
            margin-top: -2px;
            color: var(--gold-light);
            font-size: 15px;
            line-height: 1;
            transition: transform 180ms ease;
          }

          .division-menu[open] .division-chevron {
            transform: rotate(180deg);
          }

          .division-dropdown {
            position: absolute;
            top: calc(100% + 10px);
            right: -16px;
            width: 330px;
            padding: 14px;
            border: 1px solid rgba(187, 164, 95, 0.34);
            background: rgba(12, 12, 10, 0.98);
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(18px);
          }

          .division-dropdown-heading {
            padding: 12px 12px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.11);
          }

          .division-dropdown-heading small,
          .division-dropdown-heading strong {
            display: block;
          }

          .division-dropdown-heading small {
            margin-bottom: 5px;
            color: var(--gold-light);
            font-size: 9px;
            font-weight: 760;
            letter-spacing: 0.15em;
            text-transform: uppercase;
          }

          .division-dropdown-heading strong {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            font-weight: 680;
            letter-spacing: 0.02em;
            text-transform: none;
          }

          .division-dropdown > a {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding: 16px 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.72);
            font-size: 12px;
            letter-spacing: 0.055em;
            text-transform: uppercase;
            transition: color 160ms ease, background 160ms ease, padding 160ms ease;
          }

          .division-dropdown > a:last-child {
            border-bottom: 0;
          }

          .division-dropdown > a::after {
            display: none;
          }

          .division-dropdown > a:hover,
          .division-dropdown > a:focus-visible {
            padding-left: 16px;
            background: rgba(187, 164, 95, 0.08);
            color: var(--white);
          }

          .division-dropdown > a span:last-child {
            color: var(--gold-light);
            font-size: 15px;
          }
        }

        @media (min-width: 1061px) and (max-width: 1240px) {
          .refined-site-brand {
            min-width: auto;
          }

          .refined-site-brand small {
            display: none;
          }

          .refined-desktop-navigation {
            gap: 15px;
            font-size: 10px;
            letter-spacing: 0.045em;
          }
        }

        @media (max-width: 1060px) {
          .mobile-navigation {
            position: static;
          }

          .mobile-navigation > summary {
            position: relative;
            z-index: 1002;
            width: 48px;
            height: 48px;
            display: grid;
            place-content: center;
            gap: 5px;
            border: 1px solid rgba(212, 190, 121, 0.42);
            border-radius: 999px;
            background: rgba(10, 11, 9, 0.58);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
            backdrop-filter: blur(14px);
            transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
          }

          .mobile-navigation > summary:hover,
          .mobile-navigation > summary:focus-visible {
            border-color: var(--gold-light);
            background: rgba(187, 164, 95, 0.12);
          }

          .mobile-navigation > summary span {
            width: 19px;
            height: 1px;
            background: var(--gold-light);
            transform-origin: center;
            transition: transform 180ms ease, opacity 180ms ease;
          }

          .mobile-navigation[open] > summary {
            position: fixed;
            top: max(18px, env(safe-area-inset-top));
            right: max(18px, env(safe-area-inset-right));
            border-color: rgba(212, 190, 121, 0.58);
            background: rgba(23, 23, 19, 0.96);
          }

          .mobile-navigation[open] > summary span:nth-child(1) {
            transform: translateY(6px) rotate(45deg);
          }

          .mobile-navigation[open] > summary span:nth-child(2) {
            opacity: 0;
          }

          .mobile-navigation[open] > summary span:nth-child(3) {
            transform: translateY(-6px) rotate(-45deg);
          }

          .mobile-navigation > nav {
            position: fixed;
            z-index: 1000;
            inset: 0;
            width: 100vw;
            height: 100dvh;
            padding:
              max(92px, calc(env(safe-area-inset-top) + 78px))
              max(22px, calc((100vw - 680px) / 2))
              max(32px, calc(env(safe-area-inset-bottom) + 24px));
            border: 0;
            background:
              radial-gradient(circle at 92% 6%, rgba(187, 164, 95, 0.14), transparent 28%),
              linear-gradient(145deg, #11120f 0%, #0b0c0a 58%, #080907 100%);
            box-shadow: none;
            overflow-x: hidden;
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
          }

          .mobile-navigation__intro {
            padding: 0 0 28px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          }

          .mobile-navigation__intro > span {
            display: block;
            margin-bottom: 10px;
            color: var(--gold-light);
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .mobile-navigation__intro > strong {
            display: block;
            color: var(--white);
            font-size: clamp(34px, 9vw, 48px);
            font-weight: 700;
            letter-spacing: -0.045em;
            line-height: 1;
          }

          .mobile-navigation__intro > p {
            max-width: 520px;
            margin: 13px 0 0;
            color: rgba(255, 255, 255, 0.52);
            font-size: 13px;
            line-height: 1.55;
          }

          .mobile-navigation__primary {
            margin-top: 12px;
          }

          .mobile-navigation nav .mobile-navigation__primary > a {
            min-height: 72px;
            display: grid;
            grid-template-columns: 34px minmax(0, 1fr) 24px;
            gap: 12px;
            align-items: center;
            padding: 13px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            text-transform: none;
          }

          .mobile-navigation__primary > a > span {
            color: rgba(212, 190, 121, 0.56);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.12em;
          }

          .mobile-navigation__primary > a > div {
            min-width: 0;
            display: grid;
            gap: 4px;
          }

          .mobile-navigation__primary > a strong {
            color: rgba(255, 255, 255, 0.9);
            font-size: 17px;
            font-weight: 680;
            letter-spacing: -0.015em;
          }

          .mobile-navigation__primary > a small {
            color: rgba(255, 255, 255, 0.42);
            font-size: 11px;
            font-weight: 550;
            letter-spacing: 0;
          }

          .mobile-navigation__primary > a > b,
          .mobile-navigation__actions > a > b {
            color: var(--gold-light);
            font-size: 18px;
            font-weight: 500;
            text-align: right;
          }

          .mobile-division-menu {
            margin-top: 18px;
            border: 1px solid rgba(187, 164, 95, 0.24);
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.025);
            overflow: hidden;
          }

          .mobile-navigation nav .mobile-division-menu > summary {
            width: 100%;
            height: auto;
            min-height: 72px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding: 15px 18px;
            border: 0;
            border-radius: 0;
            background: transparent;
            color: var(--white);
            cursor: pointer;
            list-style: none;
            text-transform: none;
          }

          .mobile-navigation nav .mobile-division-menu > summary::-webkit-details-marker {
            display: none;
          }

          .mobile-division-menu > summary > div {
            display: grid;
            gap: 4px;
          }

          .mobile-division-menu > summary small {
            color: var(--gold-light);
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }

          .mobile-division-menu > summary strong {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 680;
          }

          .mobile-division-menu > summary > span {
            width: auto;
            height: auto;
            background: none;
            color: var(--gold-light);
            font-size: 22px;
            line-height: 1;
            transition: transform 180ms ease;
          }

          .mobile-division-menu[open] > summary > span {
            transform: rotate(45deg);
          }

          .mobile-division-menu > div {
            padding: 0 18px 8px;
            border: 0;
          }

          .mobile-navigation nav .mobile-division-menu > div a {
            min-height: 60px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 24px;
            gap: 3px 12px;
            align-content: center;
            padding: 12px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            border-bottom: 0;
            color: rgba(255, 255, 255, 0.78);
            text-transform: none;
          }

          .mobile-division-menu > div a > span {
            font-size: 14px;
            font-weight: 650;
          }

          .mobile-division-menu > div a > small {
            grid-column: 1;
            color: rgba(255, 255, 255, 0.38);
            font-size: 10px;
            letter-spacing: 0;
          }

          .mobile-division-menu > div a > b {
            grid-column: 2;
            grid-row: 1 / 3;
            align-self: center;
            color: var(--gold-light);
            font-weight: 500;
          }

          .mobile-navigation__actions {
            display: grid;
            gap: 10px;
            margin-top: 20px;
          }

          .mobile-navigation nav .mobile-navigation__actions > a {
            min-height: 66px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            padding: 12px 17px;
            border: 1px solid transparent;
            border-radius: 999px;
            text-transform: none;
          }

          .mobile-navigation__actions > a > span {
            display: grid;
            gap: 2px;
          }

          .mobile-navigation__actions > a small {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .mobile-navigation__actions > a strong {
            font-size: 14px;
            font-weight: 750;
          }

          .mobile-navigation nav .mobile-navigation__join {
            background: var(--gold);
            color: var(--ink);
          }

          .mobile-navigation__join small,
          .mobile-navigation__join > b {
            color: rgba(17, 17, 15, 0.7) !important;
          }

          .mobile-navigation nav .mobile-navigation__portal {
            border-color: rgba(212, 190, 121, 0.32);
            background: rgba(187, 164, 95, 0.07);
            color: var(--white);
          }

          .mobile-navigation__portal small {
            color: rgba(212, 190, 121, 0.68);
          }

          .mobile-navigation__footer {
            display: grid;
            gap: 5px;
            margin-top: 32px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }

          .mobile-navigation__footer > span {
            color: rgba(255, 255, 255, 0.62);
            font-size: 11px;
            font-weight: 650;
          }

          .mobile-navigation__footer > small {
            color: rgba(255, 255, 255, 0.3);
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }
        }

        @media (max-width: 640px) {
          .utility-bar {
            display: none;
          }

          .nav-shell {
            height: 76px;
          }

          .site-brand img {
            width: 48px;
            height: 48px;
          }

          .site-brand strong {
            font-size: 19px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mobile-navigation > summary span,
          .mobile-division-menu > summary > span {
            transition: none;
          }
        }
      `}</style>
    </header>
  );
}
