"use client";

import { useMemo, useState } from "react";
import {
  POLICY_DOCU_GUIDE_URL,
  POLICY_REGISTER_SOURCE,
  policyRegister,
} from "@/lib/policies/policy-register";
import styles from "./PortalPolicyDirectory.module.css";

const sections = Array.from(new Set(policyRegister.map((policy) => policy.section)));

export function PortalPolicyDirectory() {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("");

  const filteredPolicies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return policyRegister.filter((policy) => {
      const matchesSection = !section || policy.section === section;
      const matchesQuery =
        !normalized ||
        policy.name.toLowerCase().includes(normalized) ||
        policy.section.toLowerCase().includes(normalized) ||
        policy.priority.toLowerCase().includes(normalized);
      return matchesSection && matchesQuery;
    });
  }, [query, section]);

  return (
    <section className="portal-panel" id="policies">
      <div className="portal-panel-heading">
        <div><h2>Policy Directory</h2></div>
        <span>{policyRegister.length} directives</span>
      </div>

      <div className={styles.summaryCard}>
        <strong>LSCSO policy register</strong>
        <a href={POLICY_DOCU_GUIDE_URL} target="_blank" rel="noreferrer">Open Docu-Guide ↗</a>
      </div>

      <details className={styles.directory}>
        <summary>
          <span><strong>Browse policies</strong><small>{POLICY_REGISTER_SOURCE}</small></span>
          <b aria-hidden="true">⌄</b>
        </summary>

        <div className={styles.directoryBody}>
          <div className={styles.controls}>
            <label><span>Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Policy number or name" /></label>
            <label><span>Section</span><select value={section} onChange={(event) => setSection(event.target.value)}><option value="">All sections</option>{sections.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          </div>

          <div className={styles.resultCount}><strong>{filteredPolicies.length}</strong><span>shown</span></div>

          <div className={styles.policyList}>
            {filteredPolicies.map((policy) => (
              <article className={styles.policyRow} key={policy.link}>
                <div className={styles.policyMain}>
                  <div className={styles.badges}><span>{policy.section}</span><span>{policy.priority}</span></div>
                  <strong>{policy.name}</strong>
                  <small>Updated {new Date(policy.lastUpdated).toLocaleDateString()}</small>
                </div>
                <a href={policy.link} target="_blank" rel="noreferrer">Open ↗</a>
              </article>
            ))}
            {filteredPolicies.length === 0 ? <div className={styles.empty}>No matches.</div> : null}
          </div>
        </div>
      </details>
    </section>
  );
}
