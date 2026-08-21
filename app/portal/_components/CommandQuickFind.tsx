"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePortalProfile } from "./PortalProfileProvider";

type SearchItem = {
  label?: string;
  title?: string;
  detail?: string;
  subject?: string;
  type?: string;
  status?: string;
  href: string;
  personnelId?: string;
  guardianNumber?: number;
};

type SearchPayload = {
  personnel: SearchItem[];
  guardians: SearchItem[];
  certifications: SearchItem[];
  requests: SearchItem[];
};

const emptyResults: SearchPayload = { personnel: [], guardians: [], certifications: [], requests: [] };
const departmentSearchRanks = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);

export function CommandQuickFind() {
  const profile = usePortalProfile();
  const enabled = departmentSearchRanks.has(profile.rank);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPayload>(emptyResults);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled || !open || query.trim().length < 2) {
      setResults(emptyResults);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/portal/global-search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Search unavailable");
        const payload = await response.json() as SearchPayload;
        if (id === requestId.current) setResults(payload);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (id === requestId.current) setResults(emptyResults);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, open, query]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!enabled) return null;

  const total = Object.values(results).reduce((sum, items) => sum + items.length, 0);

  function close() {
    setOpen(false);
    setQuery("");
    setResults(emptyResults);
  }

  function renderGroup(title: string, items: SearchItem[], kind: "personnel" | "guardian" | "other") {
    if (!items.length) return null;
    return (
      <section className="command-quick-find-group" key={title}>
        <h3>{title}</h3>
        {items.map((item, index) => {
          const primary = item.label ?? item.title ?? item.subject ?? "Record";
          const secondary = item.detail ?? [item.subject, item.type].filter(Boolean).join(" · ");
          const prefix = kind === "guardian" && item.guardianNumber ? `G-${String(item.guardianNumber).padStart(4, "0")} · ` : "";
          return (
            <Link href={item.href} key={`${title}-${item.personnelId ?? item.guardianNumber ?? index}`} onClick={close}>
              <div><strong>{prefix}{primary}</strong>{secondary ? <span>{secondary}</span> : null}</div>
              {item.status ? <b>{item.status}</b> : null}
            </Link>
          );
        })}
      </section>
    );
  }

  return (
    <>
      <button className="command-quick-find-trigger" onClick={() => setOpen(true)} type="button" aria-label="Search department records">
        <span aria-hidden="true">⌕</span><small>Find</small>
      </button>
      {open ? (
        <div className="command-quick-find-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
          <section className="command-quick-find" role="dialog" aria-modal="true" aria-label="Command Quick Find">
            <div className="command-quick-find-head">
              <div><strong>Quick Find</strong><span>Personnel and department records</span></div>
              <button type="button" onClick={close} aria-label="Close search">×</button>
            </div>
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, S-4##, LS-###, Guardian #, certificate..." />
            <div className="command-quick-find-results">
              {query.trim().length < 2 ? <div className="command-quick-find-state">Enter at least 2 characters.</div> : null}
              {loading ? <div className="command-quick-find-state">Searching…</div> : null}
              {!loading && query.trim().length >= 2 && total === 0 ? <div className="command-quick-find-state">No matching records found.</div> : null}
              {!loading ? <>
                {renderGroup("Personnel", results.personnel, "personnel")}
                {renderGroup("Guardians", results.guardians, "guardian")}
                {renderGroup("Certifications", results.certifications, "other")}
                {renderGroup("Requests", results.requests, "other")}
              </> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
