"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DirectoryMember = {
  personnelId: string;
  displayName: string;
  rank: string;
  callSign: string | null;
  division: string;
  status: string;
};

type PersonnelDirectoryProps = {
  personnel: DirectoryMember[];
};

const RECENT_KEY = "lscso.command.recent-personnel:v1";
const FAVORITES_KEY = "lscso.command.favorite-personnel:v1";

export function PersonnelDirectory({ personnel }: PersonnelDirectoryProps) {
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      if (Array.isArray(stored)) setRecentIds(stored.filter((item) => typeof item === "string").slice(0, 6));
      const favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
      if (Array.isArray(favorites)) setFavoriteIds(favorites.filter((item) => typeof item === "string").slice(0, 12));
    } catch {
      setRecentIds([]);
      setFavoriteIds([]);
    }
  }, []);

  const recent = useMemo(
    () => recentIds.map((id) => personnel.find((member) => member.personnelId === id)).filter(Boolean) as DirectoryMember[],
    [personnel, recentIds],
  );

  const favorites = useMemo(
    () => favoriteIds.map((id) => personnel.find((member) => member.personnelId === id)).filter(Boolean) as DirectoryMember[],
    [favoriteIds, personnel],
  );

  const divisions = useMemo(() => {
    const counts = new Map<string, number>();
    personnel.forEach((member) => counts.set(member.division || "Unassigned", (counts.get(member.division || "Unassigned") ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [personnel]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return personnel.filter((member) => {
      const matchesDivision = !division || member.division === division;
      const haystack = [member.displayName, member.personnelId, member.callSign, member.rank, member.division, member.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesDivision && (!normalized || haystack.includes(normalized));
    });
  }, [division, personnel, query]);

  function remember(personnelId: string) {
    setRecentIds((current) => {
      const next = [personnelId, ...current.filter((id) => id !== personnelId)].slice(0, 6);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const isFiltered = query.trim().length > 0 || division !== null;

  return (
    <div className="command-v2-directory">
      <section className="portal-panel command-v2-directory-search">
        <div className="portal-panel-heading"><div><p>Personnel</p><h2>Find someone</h2></div><Link href="/portal/command/personnel/roster">Open full roster</Link></div>
        <label className="command-v2-search-field">
          <span>Search personnel</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a name, call sign, ID, rank, or assignment" />
        </label>
        <div className="command-v2-division-browser" aria-label="Filter personnel by assignment">
          {divisions.map(([name, count]) => (
            <button className={division === name ? "is-active" : undefined} key={name} onClick={() => setDivision((current) => current === name ? null : name)} type="button">
              <strong>{name}</strong><span>{count}</span>
            </button>
          ))}
          {division ? <button onClick={() => setDivision(null)} type="button"><strong>Clear filter</strong></button> : null}
        </div>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading">
          <div><p>{isFiltered ? "Search results" : "Department"}</p><h2>{isFiltered ? `${filtered.length} found` : `All personnel (${filtered.length})`}</h2></div>
          <Link href="/portal/command/personnel/roster">Full roster & account tools</Link>
        </div>
        <div className="command-v2-personnel-results">
          {filtered.map((member) => (
            <Link href={`/portal/command/personnel/${member.personnelId}`} key={member.personnelId} onClick={() => remember(member.personnelId)}>
              <div><strong>{favoriteIds.includes(member.personnelId) ? "★ " : ""}{member.displayName}</strong><span>{member.rank} · {member.callSign || "No call sign"} · {member.personnelId}</span></div>
              <div><span>{member.division}</span><b>{member.status}</b></div>
            </Link>
          ))}
          {!filtered.length ? <div className="portal-empty-state"><strong>No personnel match the current search or filter.</strong><span>Clear the filter or try a shorter search.</span></div> : null}
        </div>
      </section>

      {(favorites.length || recent.length) ? <div className="command-v2-workspace-grid command-v2-directory-lower">
        {favorites.length ? <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Quick access</p><h2>Pinned personnel</h2></div></div>
          <div className="command-v2-mini-list">{favorites.map((member) => <Link href={`/portal/command/personnel/${member.personnelId}`} key={member.personnelId} onClick={() => remember(member.personnelId)}><strong>★ {member.displayName}</strong><span>{member.rank} · {member.callSign || member.personnelId}</span></Link>)}</div>
        </section> : null}

        {recent.length ? <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Quick access</p><h2>Recently viewed</h2></div></div>
          <div className="command-v2-mini-list">{recent.map((member) => <Link href={`/portal/command/personnel/${member.personnelId}`} key={member.personnelId} onClick={() => remember(member.personnelId)}><strong>{member.displayName}</strong><span>{member.rank} · {member.callSign || member.personnelId}</span></Link>)}</div>
        </section> : null}
      </div> : null}
    </div>
  );
}
