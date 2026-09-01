"use client";

import { useMemo, useState } from "react";
import type { PolicyRegisterEntry } from "@/lib/policies/policy-register";
import styles from "./policies.module.css";

const sections = ["All", "General Orders", "Personnel", "Patrol", "Training", "Internal Affairs", "Special Operations"] as const;
const priorities = ["All", "High", "Medium", "Low"] as const;

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PolicyDirectory({ policies }: { policies: PolicyRegisterEntry[] }) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<(typeof sections)[number]>("All");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("All");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return policies.filter((policy) => {
      if (section !== "All" && policy.section !== section) return false;
      if (priority !== "All" && policy.priority !== priority) return false;
      if (!needle) return true;
      return `${policy.name} ${policy.section} ${policy.priority}`.toLowerCase().includes(needle);
    });
  }, [policies, priority, query, section]);

  return (
    <div className={styles.directory}>
      <div className={styles.controls}>
        <label className={styles.search}>
          <span>Search policy directory</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by policy number, name, or topic"
          />
        </label>
        <div className={styles.filters}>
          <label>
            <span>Section</span>
            <select value={section} onChange={(event) => setSection(event.target.value as (typeof sections)[number])}>
              {sections.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as (typeof priorities)[number])}>
              {priorities.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className={styles.resultBar}>
        <strong>{filtered.length}</strong>
        <span>{filtered.length === 1 ? "policy" : "policies"} shown</span>
      </div>

      <div className={styles.list}>
        {filtered.map((policy) => (
          <article className={styles.card} key={policy.link}>
            <div className={styles.cardTop}>
              <span className={styles.section}>{policy.section}</span>
              <span className={`${styles.priority} ${styles[`priority${policy.priority}`]}`}>{policy.priority} Priority</span>
            </div>
            <h2>{policy.name}</h2>
            <div className={styles.meta}>
              <span>Status: <strong>{policy.status}</strong></span>
              <span>Register updated: <strong>{formatUpdated(policy.lastUpdated)}</strong></span>
            </div>
            <a className={styles.openPolicy} href={policy.link} target="_blank" rel="noreferrer">
              Open controlling policy in Notion <span aria-hidden="true">↗</span>
            </a>
          </article>
        ))}
      </div>

      {!filtered.length ? (
        <div className={styles.empty}>
          <strong>No policies match those filters.</strong>
          <button type="button" onClick={() => { setQuery(""); setSection("All"); setPriority("All"); }}>Clear filters</button>
        </div>
      ) : null}
    </div>
  );
}
