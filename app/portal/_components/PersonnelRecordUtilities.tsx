"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const RECENT_KEY = "lscso.command.recent-personnel:v1";

type PersonnelRecordUtilitiesProps = {
  personnelId: string;
  displayName: string;
};

export function PersonnelRecordUtilities({ personnelId, displayName }: PersonnelRecordUtilitiesProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      const recentIds = Array.isArray(recent) ? recent.filter((item) => typeof item === "string") : [];
      localStorage.setItem(RECENT_KEY, JSON.stringify([personnelId, ...recentIds.filter((id) => id !== personnelId)].slice(0, 6)));

    } catch {}
  }, [personnelId]);

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
        <div><p>Common tasks</p><h2>What do you need to do?</h2></div>
        <span>{personnelId}</span>
      </div>
      <div className="personnel-record-qol-actions">
        <Link className="portal-button portal-button--primary" href={`/portal/command/guardians?q=${encodeURIComponent(personnelId)}`}>Create Guardian</Link>
        <Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${personnelId}/documents#send-letter`}>Send welcome letter</Link>
        <Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${personnelId}/administration#assignments`}>Manage assignments</Link>
        <Link className="portal-button portal-button--secondary" href="/portal/command/certifications">Issue certification</Link>
        <button className="portal-button portal-button--secondary" onClick={copyLink} type="button">{copied ? "Copied" : "Copy direct link"}</button>
      </div>
    </section>
  );
}
