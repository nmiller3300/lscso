"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/about", label: "About LSCSO" },
  { href: "/office-of-the-sheriff", label: "Office of the Sheriff" },
  { href: "/archives", label: "Historical Archives" },
];

export function AgencyHistoryNav() {
  const pathname = usePathname();

  return (
    <nav className="agency-history-nav" aria-label="Agency and history navigation">
      <div className="site-shell agency-history-nav__inner">
        <span className="agency-history-nav__label">Agency &amp; History</span>
        <div className="agency-history-nav__links">
          {links.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link className={active ? "is-active" : undefined} href={item.href} key={item.href}>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <style>{`
        .agency-history-nav {
          position: relative;
          z-index: 19;
          border-top: 1px solid rgba(255,255,255,0.045);
          border-bottom: 1px solid rgba(187,164,95,0.16);
          background: linear-gradient(90deg, rgba(17,17,15,0.985), rgba(28,26,21,0.985), rgba(17,17,15,0.985));
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }

        .agency-history-nav__inner {
          min-height: 42px;
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .agency-history-nav__label {
          flex: 0 0 auto;
          color: rgba(212,190,121,0.72);
          font-size: 9px;
          font-weight: 820;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .agency-history-nav__links {
          min-width: 0;
          display: flex;
          align-items: stretch;
          gap: 4px;
        }

        .agency-history-nav__links a {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 42px;
          padding: 0 14px;
          color: rgba(255,255,255,0.58);
          font-size: 10px;
          font-weight: 720;
          letter-spacing: 0.055em;
          text-decoration: none;
          text-transform: uppercase;
          white-space: nowrap;
          transition: color 160ms ease, background 160ms ease;
        }

        .agency-history-nav__links a:hover,
        .agency-history-nav__links a:focus-visible,
        .agency-history-nav__links a.is-active {
          color: rgba(255,255,255,0.94);
          background: rgba(187,164,95,0.065);
          outline: none;
        }

        .agency-history-nav__links a.is-active::after {
          position: absolute;
          right: 14px;
          bottom: -1px;
          left: 14px;
          height: 2px;
          background: var(--gold-light);
          content: "";
        }

        @media (max-width: 760px) {
          .agency-history-nav__inner {
            min-height: 44px;
            gap: 12px;
            padding-right: 0;
          }

          .agency-history-nav__label {
            display: none;
          }

          .agency-history-nav__links {
            width: 100%;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }

          .agency-history-nav__links::-webkit-scrollbar {
            display: none;
          }

          .agency-history-nav__links a {
            min-height: 44px;
            padding-inline: 13px;
            font-size: 9px;
          }
        }
      `}</style>
    </nav>
  );
}
