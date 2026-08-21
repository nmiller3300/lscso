"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type PersonnelTimelineCategory = "Career" | "Training" | "Recognition" | "Accountability" | "Administrative";

export type PersonnelTimelineEvent = {
  id: string;
  category: PersonnelTimelineCategory;
  title: string;
  detail: string;
  occurredAt: string;
  status?: string | null;
  href?: string | null;
};

type PersonnelTimelineProps = {
  events: PersonnelTimelineEvent[];
};

const filters: Array<"All" | PersonnelTimelineCategory> = [
  "All",
  "Career",
  "Training",
  "Recognition",
  "Accountability",
  "Administrative",
];

export function PersonnelTimeline({ events }: PersonnelTimelineProps) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const filtered = useMemo(
    () => filter === "All" ? events : events.filter((event) => event.category === filter),
    [events, filter],
  );

  return (
    <div className="personnel-timeline-shell">
      <div className="personnel-timeline-filters" aria-label="Timeline filters">
        {filters.map((item) => <button className={filter === item ? "is-active" : undefined} key={item} onClick={() => setFilter(item)} type="button">{item}</button>)}
      </div>

      <div className="personnel-timeline-list">
        {filtered.map((event) => {
          const content = <>
            <span className="personnel-timeline-marker" aria-hidden="true" />
            <div className="personnel-timeline-date">{new Date(event.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
            <div className="personnel-timeline-content">
              <div className="personnel-timeline-heading"><div><small>{event.category}</small><strong>{event.title}</strong></div>{event.status ? <b>{event.status}</b> : null}</div>
              <p>{event.detail}</p>
            </div>
          </>;

          return event.href
            ? <Link className="personnel-timeline-event is-linked" href={event.href} key={event.id}>{content}</Link>
            : <article className="personnel-timeline-event" key={event.id}>{content}</article>;
        })}
        {!filtered.length ? <div className="portal-empty-state"><strong>No {filter === "All" ? "timeline" : filter.toLowerCase()} events are on file.</strong></div> : null}
      </div>
    </div>
  );
}
