import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import "./current.css";

export const dynamic = "force-dynamic";

const folders = ["Leadership", "Criminal Organizations", "Operations", "Cold Cases", "Internal Affairs", "Achievements", "Correspondence", "Photos & Artifacts"];

function Redacted({ text }: { text: string }) {
  const pieces = text.split("{{REDACTED}}");
  return <>{pieces.map((piece, index) => <span key={`${index}-${piece.slice(0, 10)}`}>{piece}{index < pieces.length - 1 ? <span className="current-archive-redaction" aria-label="Redacted material">REDACTED</span> : null}</span>)}</>;
}

export default async function CurrentAdministrationArchivePage() {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from("current_administration_archive")
    .select("id,record_owner,folder,document_code,title,date_label,release_status,status,stamp,summary,public_body,published_at")
    .in("release_status", ["Public", "Partially Released", "Sealed"])
    .order("published_at", { ascending: false });

  const records = error ? [] : data ?? [];
  const activeFolders = folders.filter((folder) => records.some((record: any) => record.folder === folder));

  return (
    <main className="current-archive">
      <div className="current-archive-shell">
        <Link className="current-archive-back" href="/archives">← Return to Historical Archives</Link>

        <header className="current-archive-header">
          <Image src="/images/lscso-patch-subdued.png" alt="Los Santos County Sheriff's Office patch" width={80} height={80} />
          <div>
            <span>Los Santos County Sheriff&apos;s Office · Office of the Sheriff</span>
            <h1>Miller–White Released Holdings</h1>
            <small>2026–Present · Active Administration</small>
          </div>
        </header>

        <p className="current-archive-intro">This collection contains records from the active administration that have been approved for public historical review. Draft, internal, and unreleased material does not appear here. Sealed records may be acknowledged by index only.</p>

        {records.length === 0 ? (
          <div className="current-archive-empty">No Miller–White records have been released for public historical review yet. The active administration archive will grow as records are transferred, closed, or approved for release.</div>
        ) : (
          <div className="current-archive-grid">
            <nav className="current-archive-index" aria-label="Released archive folders">
              <strong>Released folders</strong>
              {activeFolders.map((folder) => <a key={folder} href={`#${folder.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and")}`}>{folder}</a>)}
            </nav>

            <div className="current-archive-records">
              {activeFolders.map((folder) => {
                const folderRecords = records.filter((record: any) => record.folder === folder);
                return (
                  <section key={folder} id={folder.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and")}>
                    {folderRecords.map((record: any) => (
                      <article className="current-archive-record" key={record.id}>
                        <div className="current-archive-release">{record.release_status}</div>
                        <div className="current-archive-code">{record.folder} · {record.document_code}</div>
                        <h2>{record.title}</h2>
                        <div className="current-archive-meta">{record.date_label}{record.status ? ` · ${record.status}` : ""}{record.record_owner ? ` · ${record.record_owner}` : ""}</div>
                        {record.release_status === "Sealed" ? (
                          <div className="current-archive-sealed"><strong>SEALED</strong><span>Record existence acknowledged. Contents are not available for public historical review.</span></div>
                        ) : (
                          <>
                            {record.summary ? <p className="current-archive-summary">{record.summary}</p> : null}
                            <div className="current-archive-body">{(record.public_body ?? []).map((paragraph: string, index: number) => <p key={`${record.id}-${index}`}><Redacted text={paragraph} /></p>)}</div>
                          </>
                        )}
                      </article>
                    ))}
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
