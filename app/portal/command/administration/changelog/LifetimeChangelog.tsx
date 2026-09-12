"use client";

import { useMemo, useState } from "react";
import type { ChangelogCategory, LifetimeChangelogEntry } from "@/lib/lifetime-changelog";
import styles from "./changelog.module.css";

type Props = {
  entries: LifetimeChangelogEntry[];
};

const ALL_CATEGORIES = "All changes";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function LifetimeChangelog({ entries }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ChangelogCategory | typeof ALL_CATEGORIES>(ALL_CATEGORIES);

  const categories = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.category))),
    [entries],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const categoryMatch = category === ALL_CATEGORIES || entry.category === category;
      const searchMatch = !needle || `${entry.title} ${entry.detail} ${entry.date} ${entry.category}`.toLowerCase().includes(needle);
      return categoryMatch && searchMatch;
    });
  }, [category, entries, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, LifetimeChangelogEntry[]>();
    for (const entry of filtered) {
      const current = groups.get(entry.date) ?? [];
      current.push(entry);
      groups.set(entry.date, current);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const activeDays = new Set(entries.map((entry) => entry.date)).size;
  const firstDate = entries.at(-1)?.date;
  const latestDate = entries[0]?.date;

  return (
    <div className={styles.workspace}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Authoritative system history</p>
          <h2>Lifetime Changelog</h2>
          <p>
            The permanent development record for the LSCSO website and Personnel Portal. Every functional create, add, remove, fix, or behavior change belongs here with its release date.
          </p>
        </div>
        <div className={styles.heroMark} aria-hidden="true">CL</div>
      </section>

      <section className={styles.stats} aria-label="Changelog summary">
        <div><span>Total recorded changes</span><strong>{entries.length}</strong></div>
        <div><span>Development days recorded</span><strong>{activeDays}</strong></div>
        <div><span>History begins</span><strong>{firstDate ? formatDate(firstDate) : "—"}</strong></div>
        <div><span>Last updated</span><strong>{latestDate ? formatDate(latestDate) : "—"}</strong></div>
      </section>

      <section className={styles.controls}>
        <label className={styles.searchLabel}>
          <span>Search history</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search features, fixes, workflows, Guardian, recruitment..."
          />
        </label>
        <label className={styles.filterLabel}>
          <span>Change type</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as ChangelogCategory | typeof ALL_CATEGORIES)}>
            <option>{ALL_CATEGORIES}</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </section>

      <div className={styles.resultBar}>
        <span>{filtered.length} {filtered.length === 1 ? "change" : "changes"} shown</span>
        {(query || category !== ALL_CATEGORIES) ? (
          <button type="button" onClick={() => { setQuery(""); setCategory(ALL_CATEGORIES); }}>Clear filters</button>
        ) : null}
      </div>

      <section className={styles.timeline} aria-live="polite">
        {grouped.length ? grouped.map(([date, dayEntries]) => (
          <article className={styles.day} key={date}>
            <div className={styles.dateRail}>
              <span className={styles.dot} aria-hidden="true" />
              <time dateTime={date}>{formatDate(date)}</time>
              <small>{dayEntries.length} {dayEntries.length === 1 ? "change" : "changes"}</small>
            </div>
            <div className={styles.entries}>
              {dayEntries.map((entry, index) => (
                <div className={styles.entry} key={`${entry.date}-${entry.category}-${entry.title}-${index}`}>
                  <span className={`${styles.category} ${styles[`category${entry.category}`]}`}>{entry.category}</span>
                  <div>
                    <h3>{entry.title}</h3>
                    <p>{entry.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        )) : (
          <div className={styles.empty}>
            <strong>No matching changes.</strong>
            <p>Try a broader search or clear the change-type filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}
