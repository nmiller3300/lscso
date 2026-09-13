import type { Metadata } from "next";
import { ArchiveEntrance } from "./ArchiveEntrance";
import "./archive-refinements.css";
import "./archive-depth.css";

export const metadata: Metadata = {
  title: "Historical Records & Archives",
  description:
    "Explore the historical records and prior administrations of the Los Santos County Sheriff’s Office, serving Los Santos County since 1963.",
};

export default function ArchivesPage() {
  return <ArchiveEntrance />;
}
