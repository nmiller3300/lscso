import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ArchiveEntranceV2, type PublicArchiveRecord } from "./ArchiveEntranceV2";
import { ArchiveNavigationEnhancer } from "./ArchiveNavigationEnhancer";
import { ArchiveImmersionEnhancer } from "./ArchiveImmersionEnhancer";
import "./archive-refinements.css";
import "./archive-depth.css";
import "./archive-room.css";
import "./archive-spatial.css";
import "./archive-era.css";

export const metadata: Metadata = {
  title: "Historical Records & Archives",
  description:
    "Explore the historical records and prior administrations of the Los Santos County Sheriff’s Office, serving Los Santos County since 1963.",
};

export const dynamic = "force-dynamic";

export default async function ArchivesPage() {
  const supabase = await createClient() as any;

  // Production uses the public-reader RPC so sealed records never expose body
  // text at the API boundary. The direct-table fallback keeps branch previews
  // functional until the release hardening migration is applied.
  const rpcResult = await supabase.rpc("get_public_current_administration_archive");
  let rows: any[] = rpcResult.error ? [] : rpcResult.data ?? [];

  if (rpcResult.error) {
    const fallback = await supabase
      .from("current_administration_archive")
      .select("id,folder,document_code,title,date_label,release_status,status,stamp,summary,public_body,published_at")
      .in("release_status", ["Public", "Partially Released", "Sealed"])
      .order("published_at", { ascending: false });
    rows = fallback.error ? [] : fallback.data ?? [];
  }

  const currentAdministrationRecords: PublicArchiveRecord[] = rows.map((row: any) => ({
    id: `current-${row.id}`,
    folder: row.folder as PublicArchiveRecord["folder"],
    documentCode: row.document_code,
    title: row.title,
    dateLabel: row.date_label,
    release: row.release_status as PublicArchiveRecord["release"],
    status: row.status ?? undefined,
    stamp: row.stamp ?? undefined,
    summary: row.release_status === "Sealed" ? "Record existence acknowledged. Contents remain sealed." : row.summary ?? "",
    body: row.release_status === "Sealed" ? [] : Array.isArray(row.public_body) ? row.public_body : [],
  }));

  return (
    <>
      <ArchiveEntranceV2 currentAdministrationRecords={currentAdministrationRecords} />
      <ArchiveNavigationEnhancer />
      <ArchiveImmersionEnhancer />
    </>
  );
}
