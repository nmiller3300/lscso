"use client";

import Link from "next/link";

export function PublicServicesNav() {
  return (
    <nav className="public-services-nav" aria-label="Public services navigation">
      <div className="site-shell public-services-nav__inner">
        <span>Public Services</span>
        <Link href="/open-records">
          <span>Open Records Request</span>
          <b aria-hidden="true">→</b>
        </Link>
      </div>

      <style>{`
        .public-services-nav {
          position: relative;
          z-index: 20;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
          border-bottom: 1px solid rgba(187, 164, 95, 0.24);
          background: #11120f;
        }

        .public-services-nav__inner {
          min-height: 42px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 18px;
        }

        .public-services-nav__inner > span {
          color: rgba(255, 255, 255, 0.42);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .public-services-nav__inner > a {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--gold-light);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.075em;
          text-transform: uppercase;
          transition: color 160ms ease;
        }

        .public-services-nav__inner > a:hover,
        .public-services-nav__inner > a:focus-visible {
          color: var(--white);
        }

        .public-services-nav__inner > a b {
          font-size: 14px;
          font-weight: 500;
        }

        @media (max-width: 640px) {
          .public-services-nav__inner {
            min-height: 48px;
            justify-content: space-between;
            gap: 12px;
          }

          .public-services-nav__inner > span {
            font-size: 8px;
          }

          .public-services-nav__inner > a {
            font-size: 9px;
          }
        }
      `}</style>
    </nav>
  );
}
