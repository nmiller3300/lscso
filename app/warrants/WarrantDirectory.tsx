"use client";

import { useMemo, useState } from "react";
import type { PublicWarrant } from "./_data";

export function WarrantDirectory({ warrants }: { warrants: PublicWarrant[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return warrants;
    return warrants.filter((warrant) => [warrant.name, warrant.alias, warrant.warrantNumber, warrant.charge, warrant.classification, warrant.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
  }, [query, warrants]);

  return (
    <div className="warrant-directory">
      <label className="warrant-search">
        <span>Search active public warrants</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, warrant number, charge..." />
      </label>
      <div className="warrant-results-meta">{filtered.length} public record{filtered.length === 1 ? "" : "s"}</div>
      <div className="warrant-table-wrap">
        <table className="warrant-table">
          <thead><tr><th>Warrant</th><th>Subject</th><th>Charge</th><th>Issued</th><th>Status</th></tr></thead>
          <tbody>{filtered.map((warrant) => <tr key={warrant.warrantNumber}><td><strong>{warrant.warrantNumber}</strong><span>{warrant.classification}</span></td><td><strong>{warrant.name}</strong><span>{warrant.alias ? `Alias: ${warrant.alias} · ` : ""}Age {warrant.age}</span></td><td>{warrant.charge}</td><td>{warrant.issued}</td><td><span className={`warrant-status warrant-status--${warrant.status.toLowerCase().replaceAll(" ", "-")}`}>{warrant.status}</span></td></tr>)}</tbody>
        </table>
      </div>
      {!filtered.length ? <p className="warrant-empty">No public warrant records match that search.</p> : null}
    </div>
  );
}
