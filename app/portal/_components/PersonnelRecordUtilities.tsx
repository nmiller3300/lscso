"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const RECENT_KEY = "lscso.command.recent-personnel:v1";
const FAVORITES_KEY = "lscso.command.favorite-personnel:v1";

type PersonnelRecordUtilitiesProps = {
  personnelId: string;
  displayName: string;
};

export function PersonnelRecordUtilities({ personnelId, displayName }: PersonnelRecordUtilitiesProps) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      const recentIds = Array.isArray(recent) ? recent.filter((item) => typeof item === "string") : [];
      localStorage.setItem(RECENT_KEY, JSON.stringify([personnelId, ...recentIds.filter((id) => id !== personnelId)].slice(0, 6)));

      const favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
      if (Array.isArray(favorites)) setFavoriteIds(favorites.filter((item) => typeof item === "string"));
    } catch {
      setFavoriteIds([]);
    }
  }, [personnelId]);

  const isFavorite = useMemo(() => favoriteIds.includes(personnelId), [favoriteIds, personnelId]);

  function toggleFavorite() {
    setFavoriteIds((current) => {
      const next = current.includes(personnelId)
        ? current.filter((id) => id !== personnelId)
        : [personnelId, ...current].slice(0, 12);
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <section className="portal-panel personnel-record-qol" aria-label={`Quick actions for ${displayName}`}>
      <div className="portal-panel-heading">
        <div><p>Quick actions</p><h2>Work from this record</h2></div>
        <span>{personnelId}</span>
      </div>
      <div className="personnel-record-qol-actions">
        <Link className="portal-button portal-button--primary" href={`/portal/command/guardians?q=${encodeURIComponent(personnelId)}`}>Guardian</Link>
        <Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${personnelId}/training`}>Training</Link>
        <Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${personnelId}/timeline`}>Timeline</Link>
        <Link className="portal-button portal-button--secondary" href="/portal/command/certifications">Issue certification</Link>
        <button className={`portal-button portal-button--secondary${isFavorite ? " is-active" : ""}`} onClick={toggleFavorite} type="button">{isFavorite ? "★ Pinned" : "☆ Pin personnel"}</button>
        <button className="portal-button portal-button--secondary" onClick={copyLink} type="button">{copied ? "Copied" : "Copy direct link"}</button>
      </div>
    </section>
  );
}
