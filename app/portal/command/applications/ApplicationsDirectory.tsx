"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  applicationLabel,
  applicationNextAction,
  applicationStatusLabel,
  APPLICATION_STATUSES,
} from "@/lib/recruitment/application";

type Item = {
  id: string;
  applicationNumber: number;
  fullName: string;
  discord: string;
  status: string;
  submittedAt: string;
  updatedAt: string;
  reviewer: string | null;
  reviewerId: string | null;
  interviewStatus: string | null;
  hired: boolean;
};

export function ApplicationsDirectory({ items, reviewers }: { items: Item[]; reviewers: Array<{ id: string; name: string }> }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [order, setOrder] = useState("newest");

  const rows = useMemo(() => items
    .filter((item) => (
      !query
      || `${item.fullName} ${item.discord} ${applicationLabel(item.applicationNumber)}`.toLowerCase().includes(query.toLowerCase())
    ) && (!status || item.status === status) && (!reviewer || item.reviewerId === reviewer))
    .sort((a, b) => order === "newest"
      ? +new Date(b.submittedAt) - +new Date(a.submittedAt)
      : +new Date(a.submittedAt) - +new Date(b.submittedAt)), [items, query, status, reviewer, order]);

  return (
    <section className="portal-panel recruitment-directory recruitment-directory--workflow">
      <div className="recruitment-filters">
        <label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Applicant, Discord, or APP number" /></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{APPLICATION_STATUSES.map((value) => <option key={value}>{applicationStatusLabel(value)}</option>)}</select></label>
        <label>Reviewer<select value={reviewer} onChange={(event) => setReviewer(event.target.value)}><option value="">All reviewers</option>{reviewers.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
        <label>Sort<select value={order} onChange={(event) => setOrder(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      </div>

      <div className="recruitment-list recruitment-list--workflow" role="list">
        {rows.map((item) => {
          const nextAction = applicationNextAction(item.status, item.interviewStatus, item.hired);
          const needsInterview = item.status === "Accepted" && !item.hired;
          return (
            <article key={item.id} role="listitem" className={needsInterview ? "is-interview" : item.status === "Submitted" ? "is-new" : item.status === "Denied" ? "is-denied" : item.hired ? "is-hired" : ""}>
              <div className="recruitment-list__identity">
                <strong>{applicationLabel(item.applicationNumber)}</strong>
                <span>{item.fullName}</span>
                <small>{item.discord}</small>
              </div>
              <div className="recruitment-list__stage">
                <b className={`recruitment-status recruitment-status--${item.status.toLowerCase().replaceAll(" ", "-")}`}>{applicationStatusLabel(item.status)}</b>
                {needsInterview ? <span>Interview: <strong>{item.interviewStatus ?? "Not Scheduled"}</strong></span> : <span>Submitted {new Date(item.submittedAt).toLocaleDateString()}</span>}
              </div>
              <div className="recruitment-list__reviewer"><span>Reviewer</span><strong>{item.reviewer ?? "Unassigned"}</strong></div>
              <div className="recruitment-list__next"><span>Next action</span><strong>{nextAction}</strong></div>
              <Link className="portal-button" href={`/portal/command/applications/${item.id}`} aria-label={`Review ${applicationLabel(item.applicationNumber)} for ${item.fullName}`}>{needsInterview ? "Open Interview" : "Review"}</Link>
            </article>
          );
        })}
        {!rows.length ? <div className="portal-empty-state"><strong>No applications match these filters.</strong><span>Adjust your search or filters to see more records.</span></div> : null}
      </div>
    </section>
  );
}
