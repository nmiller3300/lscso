import Link from "next/link";
import { removeArchiveRecord, saveArchiveRecord } from "./actions";

type ArchiveRow = {
  id: string;
  record_owner: string;
  folder: string;
  document_code: string;
  title: string;
  date_label: string;
  release_status: string;
  status: string | null;
  stamp: string | null;
  summary: string;
  public_body: string[];
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

const FOLDERS = ["Leadership", "Criminal Organizations", "Operations", "Cold Cases", "Internal Affairs", "Achievements", "Correspondence", "Photos & Artifacts"];
const RELEASES = ["Draft", "Internal", "Public", "Partially Released", "Sealed"];
const OWNERS = ["Administration", "Sheriff", "Undersheriff"];

export function ArchiveWorkspace({ records, editing }: { records: ArchiveRow[]; editing: ArchiveRow | null }) {
  return (
    <div className="archive-admin-grid">
      <section className="portal-panel">
        <div className="portal-panel-heading">
          <div><p>Current administration</p><h2>{editing ? "Edit historical record" : "Add historical record"}</h2></div>
          <span>2026–Present</span>
        </div>
        <p className="archive-admin-help">Build the Miller–White archive as RP happens. Draft and Internal records stay private. Public, Partially Released, and Sealed records become eligible for the public historical archive.</p>

        <form action={saveArchiveRecord} className="archive-admin-form">
          <input type="hidden" name="id" value={editing?.id ?? ""} />
          <div className="archive-admin-form-grid">
            <label>Record owner
              <select name="record_owner" defaultValue={editing?.record_owner ?? "Administration"}>{OWNERS.map((value) => <option key={value}>{value}</option>)}</select>
            </label>
            <label>Folder
              <select name="folder" defaultValue={editing?.folder ?? "Achievements"}>{FOLDERS.map((value) => <option key={value}>{value}</option>)}</select>
            </label>
            <label>Release status
              <select name="release_status" defaultValue={editing?.release_status ?? "Draft"}>{RELEASES.map((value) => <option key={value}>{value}</option>)}</select>
            </label>
            <label>Date / period
              <input name="date_label" defaultValue={editing?.date_label ?? "2026"} required />
            </label>
          </div>

          <label>Title
            <input name="title" defaultValue={editing?.title ?? ""} required />
          </label>

          <div className="archive-admin-form-grid">
            <label>Document code
              <input name="document_code" defaultValue={editing?.document_code ?? ""} placeholder="Auto-generated if blank" />
            </label>
            <label>Case / record status
              <input name="status" defaultValue={editing?.status ?? ""} placeholder="ACTIVE, CLOSED, COLD…" />
            </label>
            <label>Archive stamp
              <input name="stamp" defaultValue={editing?.stamp ?? ""} placeholder="PUBLIC RELEASE COPY" />
            </label>
          </div>

          <label>Archive summary
            <textarea name="summary" rows={3} defaultValue={editing?.summary ?? ""} />
          </label>

          <label>Public record text
            <textarea name="public_body" rows={10} defaultValue={(editing?.public_body ?? []).join("\n\n")} placeholder="Separate paragraphs with a blank line. Use {{REDACTED}} where the public copy should visibly redact material." />
          </label>

          <label>Internal archive notes
            <textarea name="internal_notes" rows={5} defaultValue={editing?.internal_notes ?? ""} placeholder="Executive-only notes. This field is not granted to the public role." />
          </label>

          <p className="archive-admin-owner-note">Use Administration for shared Miller–White records, Sheriff for Sheriff Miller’s leadership file, or Undersheriff for Undersheriff White’s leadership file.</p>

          <div className="archive-admin-actions">
            <button className="portal-button portal-button--primary" type="submit">{editing ? "Save Changes" : "Add to Archive"}</button>
            {editing ? <Link className="portal-button portal-button--secondary" href="/portal/command/administration/archive">Cancel Edit</Link> : null}
          </div>
        </form>

        <p className="archive-admin-section-note">A Sealed record exposes only its index existence in the public experience. Draft and Internal records remain completely absent from public archive queries.</p>
      </section>

      <aside className="portal-panel">
        <div className="portal-panel-heading">
          <div><p>Living archive</p><h2>Current holdings</h2></div>
          <span>{records.length} records</span>
        </div>

        {records.length === 0 ? <div className="archive-admin-empty">No Miller–White historical records have been added yet.</div> : (
          <div className="archive-admin-list">
            {records.map((record) => (
              <article key={record.id} className={`archive-admin-record ${editing?.id === record.id ? "is-editing" : ""}`}>
                <small>{record.folder} · {record.document_code}</small>
                <strong>{record.title}</strong>
                <p>{record.date_label}{record.status ? ` · ${record.status}` : ""}</p>
                <span className={`archive-admin-release archive-admin-release--${record.release_status.toLowerCase().replaceAll(" ", "-")}`}>{record.release_status}</span>
                <footer>
                  <div>
                    <Link className="portal-button portal-button--secondary" href={`/portal/command/administration/archive?edit=${record.id}`}>Edit</Link>
                    <form action={removeArchiveRecord}>
                      <input type="hidden" name="id" value={record.id} />
                      <button className="portal-button portal-button--secondary archive-admin-danger" type="submit">Remove</button>
                    </form>
                  </div>
                  <small>{record.record_owner}</small>
                </footer>
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
