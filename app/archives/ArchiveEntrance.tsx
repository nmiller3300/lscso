"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import "./archives.css";

type PullState = {
  x: number;
  y: number;
};

const administrations = [
  { sheriff: "Warren McCall", undersheriff: "Arthur Bell", years: "1963–1978" },
  { sheriff: "Elena Vance", undersheriff: "Raymond Cole", years: "1978–1994" },
  { sheriff: "Robert Hale", undersheriff: "Teresa Navarro", years: "1994–2009" },
  { sheriff: "Daniel Mercer", undersheriff: "James Whitaker", years: "2009–2021" },
  { sheriff: "Thomas Rourke", undersheriff: "Marcus Ellison", years: "2021–2026" },
  { sheriff: "Nicholas Miller", undersheriff: "Michael White", years: "2026–Present" },
];

const ambientBoxes = [
  "PATROL RECORDS",
  "FLEET RECORDS",
  "TRAINING FILES",
  "EXECUTIVE CORRESPONDENCE",
  "EVIDENCE LEDGERS",
  "JAIL OPERATIONS",
  "PERSONNEL ORDERS",
  "COUNTY SERVICE FILES",
];

export function ArchiveEntrance() {
  const [lightsOn, setLightsOn] = useState(false);
  const [pull, setPull] = useState<PullState>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const shelfBoxes = useMemo(() => {
    return administrations.map((administration, index) => ({
      ...administration,
      number: String(index + 1).padStart(2, "0"),
    }));
  }, []);

  const toggleLights = () => setLightsOn((current) => !current);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    origin.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!origin.current || !dragging) return;

    const rawX = event.clientX - origin.current.x;
    const rawY = event.clientY - origin.current.y;
    const x = Math.max(-18, Math.min(18, rawX));
    const y = Math.max(0, Math.min(64, rawY));

    setPull({ x, y });
  };

  const finishPull = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!origin.current) return;

    const shouldToggle = pull.y >= 28;
    origin.current = null;
    setDragging(false);
    setPull({ x: 0, y: 0 });

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (shouldToggle) {
      suppressClick.current = true;
      toggleLights();
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
  };

  return (
    <div className={`archive-experience ${lightsOn ? "is-lit" : "is-dark"}`}>
      <Link className="archive-return" href="/">
        <span aria-hidden="true">←</span>
        Return to LSCSO
      </Link>

      <div className="archive-room" aria-hidden={!lightsOn}>
        <div className="archive-room-ceiling" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="archive-room-sign">
          <Image
            src="/images/lscso-patch-subdued.png"
            alt=""
            width={74}
            height={74}
            priority
          />
          <div>
            <span>Los Santos County Sheriff&apos;s Office</span>
            <strong>Historical Records &amp; Archives</strong>
            <small>Established 1963</small>
          </div>
        </div>

        <section className="archive-shelf-wall" aria-label="Sheriff's Office historical collections">
          <div className="archive-shelf-row archive-shelf-row--ambient">
            {ambientBoxes.slice(0, 4).map((label, index) => (
              <div className={`archive-box archive-box--ambient archive-box--tone-${(index % 3) + 1}`} key={label}>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="archive-shelf-row archive-shelf-row--administrations">
            {shelfBoxes.slice(0, 3).map((administration) => (
              <article className="archive-box archive-box--administration" key={administration.sheriff}>
                <div className="archive-box-lid" />
                <div className="archive-box-label">
                  <span>Office of the Sheriff · Box {administration.number}</span>
                  <strong>{administration.sheriff} / {administration.undersheriff}</strong>
                  <small>{administration.years}</small>
                </div>
              </article>
            ))}
          </div>

          <div className="archive-shelf-row archive-shelf-row--administrations archive-shelf-row--lower">
            {shelfBoxes.slice(3).map((administration) => (
              <article className="archive-box archive-box--administration" key={administration.sheriff}>
                <div className="archive-box-lid" />
                <div className="archive-box-label">
                  <span>Office of the Sheriff · Box {administration.number}</span>
                  <strong>{administration.sheriff} / {administration.undersheriff}</strong>
                  <small>{administration.years}</small>
                </div>
              </article>
            ))}
          </div>

          <div className="archive-shelf-row archive-shelf-row--ambient archive-shelf-row--bottom">
            {ambientBoxes.slice(4).map((label, index) => (
              <div className={`archive-box archive-box--ambient archive-box--tone-${((index + 1) % 3) + 1}`} key={label}>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="archive-room-floor" aria-hidden="true" />
      </div>

      <div className="archive-room-exposure" aria-hidden="true" />
      <div className="archive-room-vignette" aria-hidden="true" />

      <div className="archive-entry-copy" aria-live="polite">
        <span className="archive-entry-kicker">Office of the Sheriff</span>
        <h1>Historical Records<br />&amp; Archives</h1>
        <p>
          {lightsOn
            ? "Archive lighting active. Historical collections are now available for review."
            : "Pull the lamp chain to enter the Sheriff’s Office historical archives."}
        </p>
      </div>

      <div className="archive-lamp-stage" aria-label="Archive desk lamp">
        <div className="archive-lamp-desk" aria-hidden="true" />
        <div className="archive-lamp-container">
          <div className="archive-lamp-glow" aria-hidden="true" />
          <div className="archive-lamp-head" aria-hidden="true" />
          <div className="archive-lamp-beam" aria-hidden="true" />
          <div className="archive-lamp-stem" aria-hidden="true" />
          <div className="archive-lamp-base" aria-hidden="true" />
          <div className="archive-lamp-desk-wash" aria-hidden="true" />

          <div
            className={`archive-lamp-chain ${dragging ? "is-dragging" : ""}`}
            aria-hidden="true"
            style={{
              height: `${80 + pull.y}px`,
              transform: `translateX(${pull.x * 0.18}px) rotate(${pull.x * 0.09}deg)`,
            }}
          />

          <button
            type="button"
            className={`archive-lamp-handle ${dragging ? "is-dragging" : ""}`}
            aria-label={lightsOn ? "Pull chain to turn archive lights off" : "Pull chain to turn archive lights on"}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPull}
            onPointerCancel={finishPull}
            onClick={() => {
              if (suppressClick.current) return;
              toggleLights();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleLights();
              }
            }}
            style={{ transform: `translate(${pull.x}px, ${pull.y}px)` }}
          >
            <span className="archive-lamp-handle-grip" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="archive-status" aria-hidden="true">
        <span className={lightsOn ? "archive-status-dot is-on" : "archive-status-dot"} />
        {lightsOn ? "ARCHIVE LIGHTING — ON" : "ARCHIVE LIGHTING — OFF"}
      </div>
    </div>
  );
}
