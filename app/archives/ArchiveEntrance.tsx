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

type Administration = {
  sheriff: string;
  undersheriff: string;
  years: string;
  slug: string;
};

const administrations: Administration[] = [
  { sheriff: "Warren McCall", undersheriff: "Arthur Bell", years: "1963–1978", slug: "mccall-bell" },
  { sheriff: "Elena Vance", undersheriff: "Raymond Cole", years: "1978–1994", slug: "vance-cole" },
  { sheriff: "Robert Hale", undersheriff: "Teresa Navarro", years: "1994–2009", slug: "hale-navarro" },
  { sheriff: "Daniel Mercer", undersheriff: "James Whitaker", years: "2009–2021", slug: "mercer-whitaker" },
  { sheriff: "Thomas Rourke", undersheriff: "Marcus Ellison", years: "2021–2026", slug: "rourke-ellison" },
  { sheriff: "Nicholas Miller", undersheriff: "Michael White", years: "2026–Present", slug: "miller-white" },
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

const mccallBellSummary =
  "The McCall–Bell administration established the Los Santos County Sheriff’s Office as a permanent county law-enforcement organization in 1963. The pair organized the first unified patrol structure, created a formal chain of command, opened the Office’s original headquarters, and established early standards for report writing, prisoner handling, and countywide calls for service as Los Santos County began a period of rapid growth.";

const mccallBellFolders = [
  "Executive File",
  "Founding Records",
  "Administrative Orders",
  "Photographs",
];

export function ArchiveEntrance() {
  const [lightsOn, setLightsOn] = useState(false);
  const [pull, setPull] = useState<PullState>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const shelfBoxes = useMemo(() => {
    return administrations.map((administration, index) => ({
      ...administration,
      number: String(index + 1).padStart(2, "0"),
    }));
  }, []);

  const collectionOpen = selectedCollection === "mccall-bell";

  const toggleLights = () => {
    if (collectionOpen) return;
    setLightsOn((current) => !current);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (collectionOpen) return;
    origin.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!origin.current || !dragging || collectionOpen) return;

    const rawX = event.clientX - origin.current.x;
    const rawY = event.clientY - origin.current.y;
    const x = Math.max(-18, Math.min(18, rawX));
    const y = Math.max(0, Math.min(64, rawY));

    setPull({ x, y });
  };

  const finishPull = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!origin.current) return;

    const shouldToggle = pull.y >= 28 && !collectionOpen;
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

  const renderAdministrationBox = (administration: (typeof shelfBoxes)[number]) => {
    const content = (
      <>
        <div className="archive-box-lid" />
        <div className="archive-box-corner-sticker" aria-hidden="true">{administration.number}</div>
        <div className="archive-box-label">
          <span>Office of the Sheriff · Box {administration.number}</span>
          <strong>{administration.sheriff} / {administration.undersheriff}</strong>
          <small>{administration.years}</small>
        </div>
      </>
    );

    if (administration.slug === "mccall-bell") {
      return (
        <button
          className="archive-box archive-box--administration archive-box--available"
          type="button"
          key={administration.slug}
          onClick={() => {
            if (lightsOn) setSelectedCollection("mccall-bell");
          }}
          aria-label="Open the Warren McCall and Arthur Bell administration archive"
          disabled={!lightsOn}
        >
          {content}
        </button>
      );
    }

    return (
      <article className="archive-box archive-box--administration" key={administration.slug}>
        {content}
      </article>
    );
  };

  return (
    <div className={`archive-experience ${lightsOn ? "is-lit" : "is-dark"} ${collectionOpen ? "is-collection-open" : ""}`}>
      <Link className="archive-return" href="/">
        <span aria-hidden="true">←</span>
        Return to LSCSO
      </Link>

      <div className="archive-room" aria-hidden={!lightsOn || collectionOpen}>
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
          <div className="archive-shelf-id" aria-hidden="true">
            <span>STACK A</span>
            <span>EXECUTIVE RECORDS</span>
          </div>

          <div className="archive-shelf-row archive-shelf-row--ambient">
            {ambientBoxes.slice(0, 4).map((label, index) => (
              <div className={`archive-box archive-box--ambient archive-box--tone-${(index % 3) + 1}`} key={label}>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="archive-shelf-row archive-shelf-row--administrations">
            {shelfBoxes.slice(0, 3).map(renderAdministrationBox)}
          </div>

          <div className="archive-shelf-row archive-shelf-row--administrations archive-shelf-row--lower">
            {shelfBoxes.slice(3).map(renderAdministrationBox)}
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
            ? "Archive lighting active. Select a historical collection to begin review."
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
              if (suppressClick.current || collectionOpen) return;
              toggleLights();
            }}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && !collectionOpen) {
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

      {collectionOpen ? (
        <section className="archive-collection-focus" role="dialog" aria-modal="true" aria-labelledby="mccall-bell-title">
          <button
            className="archive-collection-close"
            type="button"
            onClick={() => setSelectedCollection(null)}
          >
            <span aria-hidden="true">←</span>
            Back to shelves
          </button>

          <div className="archive-collection-meta">
            <span>Office of the Sheriff</span>
            <strong id="mccall-bell-title">McCall–Bell Administration</strong>
            <small>1963–1978 · Founding Administration</small>
          </div>

          <div className="archive-worktable" aria-label="McCall Bell administration archive box">
            <div className="archive-open-box" aria-hidden="true">
              <div className="archive-open-box-lid" />
              <div className="archive-open-box-back" />
              <div className="archive-folder-stack">
                {mccallBellFolders.map((folder, index) => (
                  <div className={`archive-folder archive-folder--${index + 1}`} key={folder}>
                    <span>{folder}</span>
                  </div>
                ))}
              </div>
              <div className="archive-open-box-front">
                <span>Los Santos County Sheriff&apos;s Office</span>
                <strong>McCall / Bell</strong>
                <small>Executive Records · 1963–1978</small>
              </div>
            </div>

            <article className="archive-record-sheet">
              <div className="archive-record-letterhead">
                <Image src="/images/lscso-patch-subdued.png" alt="" width={54} height={54} />
                <div>
                  <span>Los Santos County Sheriff&apos;s Office</span>
                  <strong>Office of the Sheriff — Historical Record</strong>
                  <small>Public Historical Review Copy</small>
                </div>
              </div>

              <div className="archive-record-rule" />
              <p className="archive-record-file-number">EXECUTIVE FILE · FOUNDING ADMINISTRATION</p>
              <h2>Warren McCall / Arthur Bell</h2>
              <p className="archive-record-years">1963–1978</p>
              <p className="archive-record-summary">{mccallBellSummary}</p>
              <div className="archive-record-footer">
                <span>Permanent Historical Retention</span>
                <span>LSCSO Archives</span>
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
}
