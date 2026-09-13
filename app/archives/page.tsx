import type { Metadata } from "next";
import Link from "next/link";
import { ArchiveEntrance } from "./ArchiveEntrance";
import "./archive-refinements.css";
import "./archive-depth.css";
import "./archive-room.css";
import "./active-release-link.css";

export const metadata: Metadata = {
  title: "Historical Records & Archives",
  description:
    "Explore the historical records and prior administrations of the Los Santos County Sheriff’s Office, serving Los Santos County since 1963.",
};

export default function ArchivesPage() {
  return (
    <div className="archive-page-shell">
      <ArchiveEntrance />
      <Link className="archive-current-release-link" href="/archives/current">Open Released Miller–White Holdings →</Link>
    </div>
  );
}
