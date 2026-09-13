import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ArchiveEntranceV2, type PublicArchiveRecord } from "./ArchiveEntranceV2";
import "./archive-refinements.css";
import "./archive-depth.css";
import "./archive-room.css";

export const metadata: Metadata = {
  title: "Historical Records & Archives",
  description:
    "Explore the historical records and prior administrations of the Los Santos County Sheriff’s Office, serving Los Santos County since 1963.",
};

export const dynamic = "force-dynamic";

export default async function ArchivesPage() {
  const supabase = await createClient() as any;
  const { data, error } = await supabase.rpc("get_public_current_administration_archive");

  const currentAdministrationRecords: PublicArchiveRecord[] = error
    ? []
    : (data ?? []).map((row: any) => ({
        id: `current-${row.id}`,
        folder: row.folder as PublicArchiveRecord["folder"],
        documentCode: row.document_code,
        title: row.title,
        dateLabel: row.date_label,
        release: row.release_status as PublicArchiveRecord["release"],
        status: row.status ?? undefined,
        stamp: row.stamp ?? undefined,
        summary: row.summary ?? "",
        body: Array.isArray(row.public_body) ? row.public_body : [],
      }));

  return <ArchiveEntranceV2 currentAdministrationRecords={currentAdministrationRecords} />;
}
