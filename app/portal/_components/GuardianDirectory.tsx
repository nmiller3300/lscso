"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type GuardianDirectoryRecord = {
  id: string;
  guardianNumber: number;
  recordType: string;
  status: string;
  title: string;
  subjectName: string;
  subjectPersonnelId: string;
  authorName: string;
  createdAt: string;
  followUpDueAt: string | null;
};

type GuardianDirectoryProps = {
  records: GuardianDirectoryRecord[];
  initialQuery?: string;
};

const RECENT_KEY = "lscso.command.recent-guardians:v1";

export function GuardianDirectory({ records, initialQuery = "" }: GuardianDirectoryProps) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      if (Array.isArray(stored)) setRecentIds(stored.filter((item) => typeof item === "string").slice(0, 6));
    } catch {
      setRecentIds([]);
    }
  }, []);

  const recent = useMemo(
    () => recentIds.map((id) => records.find((record) => record.id === id)).filter(Boolean) as GuardianDirectoryRecord[],
    [records, recentIds],
  );

  const statuses = useMemo(() => Array.from(new Set(records.map((record) => record.status))).sort(), [records]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized && !status) return [];
    return records.filter((record) => {
      if (status && record.status !== status) return false;
      const haystack = [
        `g-${String(record.guardianNumber).padStart(4, "0")}`,
        String(record.guardianNumber),
        record.recordType,
        record.status,
        record.title,
        record.subjectName,
        record.subjectPersonnelId,
        record.authorName,
      ].join(" ").toLowerCase();
      return !normalized || haystack.includes(normalized);
    });
  }, [query, records, status]);

  function remember(recordId: string) {
    setRecentIds((current) => {
      const next = [recordId, ...current.filter((id) => id !== recordId)].slice(0, 6);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const followUps = records
    .filter((record) => record.followUpDueAt && !["Acknowledged", "Closed"].includes(record.status))
    .sort((a, b) => new Date(a.followUpDueAt!).getTime() - new Date(b.followUpDueAt!).getTime())
    .slice(0, 5);

  const showResults = query.trim().length > 0 || status !== null;

  return (
    <div className="command-v2-directory">
      <section className="portal-panel command-v2-directory-search">
        <div className="portal-panel-heading"><div><p>Find records</p><h2>Guardian records</h2></div><Link href="/portal/command/guardians/manage">New Guardian</Link></div>
        <label className="command-v2-search-field">
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Guardian number, employee, supervisor, type..." />
        </label>
        <div className="command-v2-division-browser" aria-label="Filter Guardian status">
          {statuses.map((item) => <button className={status === item ? "is-active" : undefined} key={item} onClick={() => setStatus((current) => current === item ? null : item)} type="button"><strong>{item}</strong></button>)}
        </div>
      </section>

      {showResults ? (
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Results</p><h2>{filtered.length} found</h2></div>{status ? <button className="portal-text-button" onClick={() => setStatus(null)} type="button">Clear status</button> : null}</div>
          <div className="command-v2-personnel-results">
            {filtered.map((record) => (
              <Link href={`/portal/command/guardians/${record.guardianNumber}`} key={record.id} onClick={() => remember(record.id)}>
                <div><strong>G-{String(record.guardianNumber).padStart(4, "0")} · {record.title}</strong><span>{record.subjectName} · {record.recordType} · {record.authorName}</span></div>
                <div><span>{new Date(record.createdAt).toLocaleDateString()}</span><b>{record.status}</b></div>
              </Link>
            ))}
            {!filtered.length ? <div className="portal-empty-state"><strong>No Guardian records match the current search.</strong></div> : null}
          </div>
        </section>
      ) : null}

      <div className="command-v2-workspace-grid command-v2-directory-lower">
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Repeat access</p><h2>Recently viewed</h2></div></div>
          {recent.length ? <div className="command-v2-mini-list">{recent.map((record) => <Link href={`/portal/command/guardians/${record.guardianNumber}`} key={record.id} onClick={() => remember(record.id)}><strong>G-{String(record.guardianNumber).padStart(4, "0")} · {record.subjectName}</strong><span>{record.recordType} · {record.status}</span></Link>)}</div> : <div className="portal-empty-state"><strong>No recently viewed Guardians yet.</strong></div>}
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Follow-up</p><h2>Needs attention</h2></div></div>
          {followUps.length ? <div className="command-v2-mini-list">{followUps.map((record) => <Link href={`/portal/command/guardians/${record.guardianNumber}`} key={record.id} onClick={() => remember(record.id)}><strong>G-{String(record.guardianNumber).padStart(4, "0")} · {record.subjectName}</strong><span>Due {new Date(record.followUpDueAt!).toLocaleDateString()} · {record.status}</span></Link>)}</div> : <div className="portal-empty-state"><strong>No Guardian follow-ups due.</strong></div>}
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Actions</p><h2>Guardian management</h2></div></div>
          <p className="command-v2-compact-copy">Open the full workspace to create, edit, approve, acknowledge, or manage Guardian records.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--primary" href="/portal/command/guardians/manage">Open Guardian workspace</Link></div>
        </section>
      </div>
    </div>
  );
}
