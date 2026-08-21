"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePortalProfile } from "./PortalProfileProvider";

type SearchItem = {
  id?: string;
  label?: string;
  title?: string;
  detail?: string;
  subject?: string;
  type?: string;
  status?: string;
  href: string;
  personnelId?: string;
  guardianNumber?: number;
  requestNumber?: number;
};

type SearchPayload = {
  personnel: SearchItem[];
  guardians: SearchItem[];
  certifications: SearchItem[];
  requests: SearchItem[];
  awards: SearchItem[];
  flags: SearchItem[];
};

const emptyResults: SearchPayload = { personnel: [], guardians: [], certifications: [], requests: [], awards: [], flags: [] };
const allowedTiers = new Set(["Executive", "Command", "Supervisor", "Preliminary"]);
const recentKey = "lscso-command-search-recent";

export function CommandQuickFind() {
  const profile = usePortalProfile();
  const enabled = allowedTiers.has(profile.access_tier);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPayload>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(recentKey) ?? "[]");
      if (Array.isArray(saved)) setRecent(saved.filter((value) => typeof value === "string").slice(0, 5));
    } catch {
      setRecent([]);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (!typing && event.key === "/") {
        event.preventDefault();
        setOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [enabled]);

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
    }, 160);

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

  const total = useMemo(() => Object.values(results).reduce((sum, items) => sum + items.length, 0), [results]);
  if (!enabled) return null;

  function rememberSearch(value: string) {
    const clean = value.trim();
    if (clean.length < 2) return;
    const next = [clean, ...recent.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
    setRecent(next);
    try { window.localStorage.setItem(recentKey, JSON.stringify(next)); } catch {}
  }

  function close() {
    rememberSearch(query);
    setOpen(false);
    setQuery("");
    setResults(emptyResults);
  }

  function renderGroup(title: string, items: SearchItem[], kind: "personnel" | "guardian" | "other") {
    if (!items.length) return null;
    return (
      <section className="command-quick-find-group" key={title}>
        <h3>{title}<span>{items.length}</span></h3>
        {items.map((item, index) => {
          const primary = item.label ?? item.title ?? item.subject ?? "Record";
          const secondary = item.detail ?? [item.subject, item.type].filter(Boolean).join(" · ");
          const prefix = kind === "guardian" && item.guardianNumber ? `G-${String(item.guardianNumber).padStart(4, "0")} · ` : "";
          return (
            <Link href={item.href} key={`${title}-${item.id ?? item.personnelId ?? item.guardianNumber ?? item.requestNumber ?? index}`} onClick={close}>
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
        <span aria-hidden="true">⌕</span><small>Search</small>
      </button>
      {open ? (
        <div className="command-quick-find-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
          <section className="command-quick-find" role="dialog" aria-modal="true" aria-label="Universal Command Search">
            <div className="command-quick-find-head">
              <div><strong>Universal Command Search</strong><span>Search every department record you are authorized to access</span></div>
              <button type="button" onClick={close} aria-label="Close search">×</button>
            </div>
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Person, callsign, Guardian #, certification, award, request, topic..." />
            {!query && recent.length ? (
              <div className="command-quick-find-recent">
                <span>Recent searches</span>
                <div>{recent.map((item) => <button type="button" key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
              </div>
            ) : null}
            <div className="command-quick-find-results">
              {query.trim().length > 0 && query.trim().length < 2 ? <div className="command-quick-find-state">Enter at least 2 characters.</div> : null}
              {!query.trim() ? <div className="command-quick-find-state">Search by person, record number, unit, certification, award, request, or topic. Press Esc to close.</div> : null}
              {loading ? <div className="command-quick-find-state">Searching authorized records…</div> : null}
              {!loading && query.trim().length >= 2 && total === 0 ? <div className="command-quick-find-state">No matching authorized records found.</div> : null}
              {!loading ? <>
                {renderGroup("Personnel", results.personnel, "personnel")}
                {renderGroup("Guardians", results.guardians, "guardian")}
                {renderGroup("Certifications", results.certifications, "other")}
                {renderGroup("Awards", results.awards, "other")}
                {renderGroup("Requests", results.requests, "other")}
                {renderGroup("Service Flags", results.flags, "other")}
              </> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
