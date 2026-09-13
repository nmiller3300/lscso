"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  archiveCollections,
  archiveFolders,
  getArchiveCollection,
  type ArchiveFolder,
  type ArchiveRecord,
  type ArchiveRelease,
} from "./archive-canon";
import { sealedArchiveRecords } from "./archive-sealed";
import "./archives.css";

export type PublicArchiveFolder = ArchiveFolder | "Photos & Artifacts";

export type PublicArchiveRecord = Omit<ArchiveRecord, "folder"> & {
  folder: PublicArchiveFolder;
};

type PullState = { x: number; y: number };
type RoomBay = 0 | 1 | 2;
type ShelfShortcut = { slug: string; recordId: string; label: string; years: string; marker: string };

type ArchiveEntranceProps = {
  currentAdministrationRecords?: PublicArchiveRecord[];
};

const currentAdministration = {
  slug: "miller-white",
  sheriff: "Nicholas Miller",
  undersheriff: "Michael White",
  years: "2026–Present",
  descriptor: "Active Administration",
};

const administrations = [...archiveCollections, currentAdministration];
const displayFolders: PublicArchiveFolder[] = [...archiveFolders, "Photos & Artifacts"];

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

const investigationShortcuts: ShelfShortcut[] = [
  { slug: "mccall-bell", recordId: "operation-iron-range", label: "Operation Iron Range", years: "1969–1971", marker: "OP-IR-69" },
  { slug: "vance-cole", recordId: "operation-streetlight", label: "Operation Streetlight", years: "1986–1988", marker: "OP-ST-86" },
  { slug: "hale-navarro", recordId: "operation-cold-harbor", label: "Operation Cold Harbor", years: "1999–2003", marker: "OP-CH-99" },
  { slug: "mercer-whitaker", recordId: "operation-glass-ledger", label: "Operation Glass Ledger", years: "2012–2014", marker: "OP-GL-12" },
  { slug: "rourke-ellison", recordId: "operation-canyon-watch", label: "Operation Canyon Watch", years: "2022–2023", marker: "OP-CW-22" },
  { slug: "hale-navarro", recordId: "blackwater-group-dossier", label: "Blackwater Group", years: "1997–2004", marker: "ORG-98-009" },
];

const standardsShortcuts: ShelfShortcut[] = [
  { slug: "mccall-bell", recordId: "dry-creek-file", label: "Dry Creek Disappearance", years: "1972", marker: "CC-72-031" },
  { slug: "vance-cole", recordId: "route-nine-cold-case", label: "Route Nine Courier", years: "1987", marker: "CC-87-044" },
  { slug: "hale-navarro", recordId: "transfer-yard-seven", label: "Transfer Yard Seven", years: "1997", marker: "CC-97-062" },
  { slug: "mercer-whitaker", recordId: "warehouse-41", label: "Warehouse 41", years: "2011", marker: "CC-11-028" },
  { slug: "rourke-ellison", recordId: "route-68-night-run", label: "Route 68 Night Run", years: "2022", marker: "CC-22-019" },
  { slug: "mccall-bell", recordId: "property-room-review", label: "Property Room Ledger Review", years: "1973–1974", marker: "IA-73-006" },
  { slug: "hale-navarro", recordId: "evidence-room-three-audit", label: "Evidence Room Three Audit", years: "2001", marker: "IA-01-019" },
  { slug: "rourke-ellison", recordId: "division-consistency-review", label: "Division Consistency Review", years: "2021–2022", marker: "IA-21-003" },
];

const roomBayLabels = [
  { stack: "STACK A", title: "Executive Records", detail: "Sheriff & Undersheriff administrations" },
  { stack: "STACK B", title: "Investigations & Operations", detail: "Organized crime, stings & major cases" },
  { stack: "STACK C", title: "Cold Case & Standards", detail: "Cold cases, internal review & accountability" },
] as const;

const currentAdministrationSummary =
  "The Miller–White administration is focused on building a modern Sheriff’s Office without losing the practical traditions that shaped LSCSO. Current priorities include professional accountability, stronger personnel development, clearly defined supervisory authority, accessible command systems, and consistent standards across every division. The administration continues to expand the Office’s operational structure while emphasizing judgment, leadership, service, and trust at every level of the organization.";

function RedactedText({ text }: { text: string }) {
  const pieces = text.split("{{REDACTED}}");
  return (
    <>
      {pieces.map((piece, index) => (
        <Fragment key={`${piece.slice(0, 18)}-${index}`}>
          {piece}
          {index < pieces.length - 1 ? (
            <span className="archive-redaction" role="img" aria-label="Redacted information">
              <span aria-hidden="true">REDACTED MATERIAL</span>
            </span>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

function ArchiveRecordSheet({ record }: { record: PublicArchiveRecord }) {
  if (record.release === "Sealed") {
    return (
      <article className="archive-record-sheet archive-record-sheet--sealed" key={record.id}>
        <div className="archive-sealed-index-card">
          <span>{record.documentCode}</span>
          <strong>SEALED RECORD</strong>
          <small>{record.dateLabel}</small>
        </div>
        <div className="archive-record-letterhead">
          <Image src="/images/lscso-patch-subdued.png" alt="" width={54} height={54} />
          <div>
            <span>Los Santos County Sheriff&apos;s Office</span>
            <strong>Historical Archive Index</strong>
            <small>Record existence acknowledged · contents restricted</small>
          </div>
        </div>
        <div className="archive-record-rule" />
        <p className="archive-record-file-number">{record.folder} · {record.documentCode}</p>
        <h2>{record.title}</h2>
        <p className="archive-record-years">{record.dateLabel}</p>
        <p className="archive-record-summary">{record.summary}</p>
        <div className="archive-sealed-notice">
          <strong>SEALED</strong>
          <p>The contents of this record are not available for public historical review. Only the archival index entry is released.</p>
        </div>
        <div className="archive-record-footer">
          <span>Restricted Historical Holding</span>
          <span>LSCSO Archives</span>
        </div>
      </article>
    );
  }

  return (
    <article className="archive-record-sheet" key={record.id}>
      <div className="archive-record-accession" aria-hidden="true">
        <span>{record.release === "Partially Released" ? "PARTIAL" : "PUBLIC"}</span>
        <strong>{record.documentCode}</strong>
        <small>{record.status ?? "ARCHIVE"}</small>
      </div>
      <div className="archive-record-letterhead">
        <Image src="/images/lscso-patch-subdued.png" alt="" width={54} height={54} />
        <div>
          <span>Los Santos County Sheriff&apos;s Office</span>
          <strong>Office of the Sheriff — Historical Record</strong>
          <small>{record.release === "Partially Released" ? "Public Release Copy · Redactions May Remain" : "Public Historical Review Copy"}</small>
        </div>
      </div>
      <div className="archive-record-rule" />
      <p className="archive-record-file-number">{record.folder} · {record.documentCode}</p>
      <h2>{record.title}</h2>
      <p className="archive-record-years">{record.dateLabel}{record.status ? ` · ${record.status}` : ""}</p>
      <p className="archive-record-deck">{record.summary}</p>
      <div className="archive-record-body">
        {record.body.map((paragraph, index) => (
          <p key={`${record.id}-${index}`}><RedactedText text={paragraph} /></p>
        ))}
      </div>
      {record.stamp ? <div className="archive-document-stamp">{record.stamp}</div> : null}
      <div className="archive-record-footer">
        <span>{record.release}</span>
        <span>LSCSO Archives</span>
      </div>
    </article>
  );
}

export function ArchiveEntranceV2({ currentAdministrationRecords = [] }: ArchiveEntranceProps) {
  const [lightsOn, setLightsOn] = useState(false);
  const [pull, setPull] = useState<PullState>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [roomBay, setRoomBay] = useState<RoomBay>(0);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<PublicArchiveFolder>("Leadership");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const suppressBayClick = useRef(false);

  const recordsForCollection = (slug: string | null): PublicArchiveRecord[] => {
    if (!slug) return [];
    if (slug === "miller-white") return currentAdministrationRecords;
    const collection = getArchiveCollection(slug);
    if (!collection) return [];
    return [...collection.records, ...(sealedArchiveRecords[slug] ?? [])] as PublicArchiveRecord[];
  };

  const collectionOpen = selectedCollection !== null;
  const currentCollectionOpen = selectedCollection === "miller-white";
  const historicalCollection = getArchiveCollection(selectedCollection);
  const collectionRecords = recordsForCollection(selectedCollection);
  const folderRecords = collectionRecords.filter((record) => record.folder === selectedFolder);
  const activeRecord = folderRecords.find((record) => record.id === selectedRecordId) ?? folderRecords[0] ?? collectionRecords[0] ?? null;

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
    setPull({ x: Math.max(-18, Math.min(18, rawX)), y: Math.max(0, Math.min(64, rawY)) });
  };

  const finishPull = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!origin.current) return;
    const shouldToggle = pull.y >= 28 && !collectionOpen;
    origin.current = null;
    setDragging(false);
    setPull({ x: 0, y: 0 });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (shouldToggle) {
      suppressClick.current = true;
      toggleLights();
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
  };

  const openCollection = (slug: string) => {
    if (!lightsOn) return;
    const records = recordsForCollection(slug);
    const firstFolder = records[0]?.folder ?? "Leadership";
    setSelectedFolder(firstFolder);
    setSelectedRecordId(records[0]?.id ?? null);
    setSelectedCollection(slug);
  };

  const openRecordLocation = (slug: string, recordId: string) => {
    if (!lightsOn) return;
    const record = recordsForCollection(slug).find((item) => item.id === recordId);
    if (!record) return;
    setSelectedFolder(record.folder);
    setSelectedRecordId(record.id);
    setSelectedCollection(slug);
  };

  const closeCollection = () => {
    setSelectedCollection(null);
    setSelectedRecordId(null);
  };

  const chooseFolder = (folder: PublicArchiveFolder) => {
    const nextRecords = collectionRecords.filter((record) => record.folder === folder);
    setSelectedFolder(folder);
    setSelectedRecordId(nextRecords[0]?.id ?? null);
  };

  const moveBay = (direction: -1 | 1) => {
    setRoomBay((current) => Math.max(0, Math.min(2, current + direction)) as RoomBay);
  };

  const handleBayPointerUp = (direction: -1 | 1, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    suppressBayClick.current = true;
    moveBay(direction);
    window.setTimeout(() => { suppressBayClick.current = false; }, 450);
  };

  const handleBayClick = (direction: -1 | 1) => {
    if (suppressBayClick.current) return;
    moveBay(direction);
  };

  const renderAdministrationBox = (administration: (typeof administrations)[number], index: number) => {
    const current = administration.slug === "miller-white";
    return (
      <button
        className={`archive-box archive-box--administration archive-box--available ${current ? "archive-box--active-admin" : ""}`}
        type="button"
        key={administration.slug}
        onClick={() => openCollection(administration.slug)}
        aria-label={`Open the ${administration.sheriff} and ${administration.undersheriff} administration archive`}
        disabled={!lightsOn}
      >
        <div className="archive-box-lid" />
        <div className="archive-box-corner-sticker" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
        <div className="archive-box-label">
          <span>Office of the Sheriff · Box {String(index + 1).padStart(2, "0")}</span>
          <strong>{administration.sheriff} / {administration.undersheriff}</strong>
          <small>{administration.years}</small>
          <em>{current ? `${currentAdministrationRecords.length} released records · active administration` : "Available for historical review"}</em>
        </div>
      </button>
    );
  };

  const renderShortcutBox = (shortcut: ShelfShortcut, index: number) => (
    <button
      className={`archive-case-box archive-case-box--tone-${(index % 3) + 1}`}
      key={`${shortcut.slug}-${shortcut.recordId}`}
      type="button"
      onClick={() => openRecordLocation(shortcut.slug, shortcut.recordId)}
    >
      <span>{shortcut.marker}</span>
      <strong>{shortcut.label}</strong>
      <small>{shortcut.years}</small>
    </button>
  );

  const renderDeepArchive = (boxTitle: string, boxYears: string) => (
    <div className="archive-deep-worktable">
      <aside className="archive-folder-directory" aria-label="Archive folders">
        <div className="archive-directory-box-label">
          <span>Los Santos County Sheriff&apos;s Office</span>
          <strong>{boxTitle}</strong>
          <small>{boxYears}</small>
        </div>
        {displayFolders.map((folder) => {
          const count = collectionRecords.filter((record) => record.folder === folder).length;
          return (
            <button
              type="button"
              key={folder}
              className={selectedFolder === folder ? "is-selected" : ""}
              onClick={() => chooseFolder(folder)}
              disabled={count === 0}
            >
              <span>{folder}</span>
              <small>{count} {count === 1 ? "file" : "files"}</small>
            </button>
          );
        })}
      </aside>

      <section className="archive-record-index" aria-label={`${selectedFolder} file index`}>
        <div className="archive-index-heading">
          <span>{selectedFolder}</span>
          <strong>File Index</strong>
          <small>{folderRecords.length} indexed {folderRecords.length === 1 ? "record" : "records"}</small>
        </div>
        <div className="archive-index-list">
          {folderRecords.map((record) => (
            <button
              key={record.id}
              type="button"
              className={activeRecord?.id === record.id ? "is-selected" : ""}
              onClick={() => setSelectedRecordId(record.id)}
            >
              <span>{record.documentCode}</span>
              <strong>{record.title}</strong>
              <small>{record.dateLabel}</small>
              <em className={`archive-release archive-release--${record.release.toLowerCase().replaceAll(" ", "-")}`}>{record.release}</em>
            </button>
          ))}
        </div>
      </section>

      {activeRecord ? <ArchiveRecordSheet record={activeRecord} /> : <div className="archive-empty-folder">No released records are indexed in this folder.</div>}
    </div>
  );

  return (
    <div className={`archive-experience ${lightsOn ? "is-lit" : "is-dark"} ${collectionOpen ? "is-collection-open" : ""}`}>
      <Link className="archive-return" href="/"><span aria-hidden="true">←</span>Return to LSCSO</Link>

      <div className="archive-room" aria-hidden={!lightsOn || collectionOpen}>
        <div className="archive-room-ceiling" aria-hidden="true"><span /><span /><span /></div>
        <div className="archive-room-sign">
          <Image src="/images/lscso-patch-subdued.png" alt="" width={74} height={74} priority />
          <div>
            <span>Los Santos County Sheriff&apos;s Office</span>
            <strong>Historical Records &amp; Archives</strong>
            <small>Established 1963</small>
          </div>
        </div>

        <div className="archive-bay-track" style={{ transform: `translate3d(-${roomBay * 100}vw, 0, 0)` }}>
          <section className="archive-bay archive-bay--executive" aria-label="Executive records stack">
            <section className="archive-shelf-wall archive-shelf-wall--bay">
              <div className="archive-shelf-id" aria-hidden="true"><span>STACK A</span><span>EXECUTIVE RECORDS</span></div>
              <div className="archive-shelf-row archive-shelf-row--ambient">
                {ambientBoxes.slice(0, 4).map((label, index) => <div className={`archive-box archive-box--ambient archive-box--tone-${(index % 3) + 1}`} key={label}><span>{label}</span></div>)}
              </div>
              <div className="archive-shelf-row archive-shelf-row--administrations">{administrations.slice(0, 3).map(renderAdministrationBox)}</div>
              <div className="archive-shelf-row archive-shelf-row--administrations archive-shelf-row--lower">
                {administrations.slice(3).map((administration, index) => renderAdministrationBox(administration, index + 3))}
              </div>
              <div className="archive-shelf-row archive-shelf-row--ambient archive-shelf-row--bottom">
                {ambientBoxes.slice(4).map((label, index) => <div className={`archive-box archive-box--ambient archive-box--tone-${((index + 1) % 3) + 1}`} key={label}><span>{label}</span></div>)}
              </div>
            </section>
          </section>

          <section className="archive-bay archive-bay--investigations" aria-label="Investigations and operations stack">
            <section className="archive-case-shelf archive-case-shelf--operations">
              <div className="archive-shelf-id" aria-hidden="true"><span>STACK B</span><span>INVESTIGATIONS &amp; OPERATIONS</span></div>
              <div className="archive-case-shelf-heading"><small>Major case holdings</small><strong>Organized Crime / Special Operations</strong><span>Selected public-release case cartons</span></div>
              <div className="archive-case-grid">{investigationShortcuts.map(renderShortcutBox)}</div>
              <div className="archive-case-shelf-lower" aria-hidden="true"><span>INTELLIGENCE INDEX</span><span>SURVEILLANCE LOGS</span><span>WARRANT RETURNS</span><span>AFTER-ACTION REPORTS</span></div>
            </section>
          </section>

          <section className="archive-bay archive-bay--standards" aria-label="Cold case and professional standards stack">
            <section className="archive-case-shelf archive-case-shelf--standards">
              <div className="archive-shelf-id" aria-hidden="true"><span>STACK C</span><span>COLD CASE &amp; PROFESSIONAL STANDARDS</span></div>
              <div className="archive-case-shelf-heading"><small>Restricted historical holdings</small><strong>Cold Case / Internal Review</strong><span>Released indexes and historical review copies</span></div>
              <div className="archive-case-grid archive-case-grid--dense">{standardsShortcuts.map(renderShortcutBox)}</div>
              <div className="archive-sealed-cartons" aria-hidden="true"><span>SEALED PERSONNEL APPENDICES</span><span>CONFIDENTIAL SOURCE REGISTERS</span></div>
            </section>
          </section>
        </div>
        <div className="archive-room-floor" aria-hidden="true" />
      </div>

      <div className="archive-room-exposure" aria-hidden="true" />
      <div className="archive-room-vignette" aria-hidden="true" />

      <div className="archive-entry-copy" aria-live="polite">
        <span className="archive-entry-kicker">Office of the Sheriff</span>
        <h1>Historical Records<br />&amp; Archives</h1>
        <p>{lightsOn ? "Archive lighting active. Move between record stacks or select a historical collection." : "Pull the lamp chain to enter the Sheriff’s Office historical archives."}</p>
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
          <div className={`archive-lamp-chain ${dragging ? "is-dragging" : ""}`} aria-hidden="true" style={{ height: `${80 + pull.y}px`, transform: `translateX(${pull.x * 0.18}px) rotate(${pull.x * 0.09}deg)` }} />
          <button
            type="button"
            className={`archive-lamp-handle ${dragging ? "is-dragging" : ""}`}
            aria-label={lightsOn ? "Pull chain to turn archive lights off" : "Pull chain to turn archive lights on"}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPull}
            onPointerCancel={finishPull}
            onClick={() => { if (!suppressClick.current && !collectionOpen) toggleLights(); }}
            onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !collectionOpen) { event.preventDefault(); toggleLights(); } }}
            style={{ transform: `translate(${pull.x}px, ${pull.y}px)` }}
          >
            <span className="archive-lamp-handle-grip" aria-hidden="true" />
          </button>
        </div>
      </div>

      {lightsOn && !collectionOpen ? (
        <nav className="archive-room-nav" aria-label="Archive room stacks">
          <button
            type="button"
            onPointerUp={(event) => handleBayPointerUp(-1, event)}
            onClick={() => handleBayClick(-1)}
            disabled={roomBay === 0}
            aria-label="Previous archive stack"
          ><span aria-hidden="true">←</span><small>Previous</small></button>
          <div><span>{roomBayLabels[roomBay].stack}</span><strong>{roomBayLabels[roomBay].title}</strong><small>{roomBayLabels[roomBay].detail}</small></div>
          <button
            type="button"
            onPointerUp={(event) => handleBayPointerUp(1, event)}
            onClick={() => handleBayClick(1)}
            disabled={roomBay === 2}
            aria-label="Next archive stack"
          ><small>Next</small><span aria-hidden="true">→</span></button>
        </nav>
      ) : null}

      <div className="archive-status" aria-hidden="true"><span className={lightsOn ? "archive-status-dot is-on" : "archive-status-dot"} />{lightsOn ? "ARCHIVE LIGHTING — ON" : "ARCHIVE LIGHTING — OFF"}</div>

      {collectionOpen ? (
        <section className="archive-collection-focus" role="dialog" aria-modal="true" aria-labelledby="archive-collection-title">
          <button className="archive-collection-close" type="button" onClick={closeCollection}><span aria-hidden="true">←</span>Back to room</button>

          {currentCollectionOpen ? (
            <>
              <div className="archive-collection-meta">
                <span>Office of the Sheriff · Active Records</span>
                <strong id="archive-collection-title">Miller–White Administration</strong>
                <small>2026–Present · Active Administration · {collectionRecords.length} released {collectionRecords.length === 1 ? "record" : "records"}</small>
              </div>
              <div className="archive-current-administration">
                <article className="archive-current-brief">
                  <div className="archive-record-letterhead">
                    <Image src="/images/lscso-patch-subdued.png" alt="" width={62} height={62} />
                    <div><span>Los Santos County Sheriff&apos;s Office</span><strong>Active Executive Records</strong><small>Historical transfer remains in progress</small></div>
                  </div>
                  <h2>Current Administration Overview</h2>
                  <p>{currentAdministrationSummary}</p>
                  <div className="archive-active-stamp">ACTIVE RECORDS</div>
                </article>
                <aside className="archive-current-leadership">
                  <p className="archive-current-kicker">Executive leadership files</p>
                  <div><span>S-401</span><strong>Sheriff Nicholas Miller</strong><small>2026–Present</small></div>
                  <div><span>S-402</span><strong>Undersheriff Michael White</strong><small>2026–Present</small></div>
                  <p className="archive-current-note">Records from the active administration enter this public collection only after executive release. Draft and internal holdings remain outside the public archive.</p>
                </aside>
              </div>
              {collectionRecords.length ? renderDeepArchive("Miller / White — Released Records", "2026–Present") : (
                <div className="archive-empty-folder">No Miller–White records have been released for public historical review yet.</div>
              )}
            </>
          ) : historicalCollection ? (
            <>
              <div className="archive-collection-meta">
                <span>Office of the Sheriff · Historical Collection</span>
                <strong id="archive-collection-title">{historicalCollection.sheriff} / {historicalCollection.undersheriff}</strong>
                <small>{historicalCollection.years} · {historicalCollection.descriptor} · {collectionRecords.length} indexed records</small>
              </div>
              {renderDeepArchive(`${historicalCollection.sheriff} / ${historicalCollection.undersheriff}`, historicalCollection.years)}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}