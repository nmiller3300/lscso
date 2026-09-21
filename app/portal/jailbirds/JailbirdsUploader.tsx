"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type EditableJailbird = {
  id: string;
  full_name: string;
  booking_number: string | null;
  charges: string | null;
  arrested_at: string;
  expires_at: string;
  imageUrl: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function JailbirdsManager({ records }: { records: EditableJailbird[] }) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<EditableJailbird | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function beginEdit(record: EditableJailbird) {
    setEditing(record);
    setStatus("");
    window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function cancelEdit() {
    setEditing(null);
    setStatus("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (editing) formData.set("id", editing.id);

    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/portal/jailbirds", {
        method: editing ? "PATCH" : "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || (editing ? "Update failed." : "Upload failed."));

      form.reset();
      setEditing(null);
      setStatus(editing
        ? "Changes saved. The original 72-hour expiration time was preserved."
        : "Published. This entry will automatically expire 72 hours after upload.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : editing ? "Update failed." : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: EditableJailbird) {
    const confirmed = window.confirm(`Remove ${record.full_name} from Jailbirds now? This also deletes the booking photograph.`);
    if (!confirmed) return;

    setDeletingId(record.id);
    setStatus("");

    try {
      const response = await fetch("/api/portal/jailbirds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Removal failed.");

      if (editing?.id === record.id) setEditing(null);
      setStatus(`${record.full_name} was removed from Jailbirds.`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Removal failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="jailbirds-admin-manager">
      <section className="jailbirds-admin-panel jailbirds-admin-current">
        <div className="jailbirds-admin-panel__heading">
          <div>
            <span>Current Releases</span>
            <h2>Active Jailbird profiles</h2>
          </div>
          <strong>{records.length} ACTIVE</strong>
        </div>

        {records.length ? (
          <div className="jailbirds-admin-record-list">
            {records.map((record) => (
              <article className={`jailbirds-admin-record${editing?.id === record.id ? " is-editing" : ""}`} key={record.id}>
                <div className="jailbirds-admin-record__photo">
                  {record.imageUrl ? <img src={record.imageUrl} alt="" /> : <span>No photo</span>}
                </div>
                <div className="jailbirds-admin-record__body">
                  <div className="jailbirds-admin-record__title">
                    <span>{record.booking_number || "No booking number"}</span>
                    <h3>{record.full_name}</h3>
                  </div>
                  <div className="jailbirds-admin-record__meta">
                    <p><span>Arrested</span>{formatDate(record.arrested_at)}</p>
                    <p><span>Expires</span>{formatDate(record.expires_at)}</p>
                  </div>
                  <p className="jailbirds-admin-record__charges">{record.charges || "No charges entered."}</p>
                </div>
                <div className="jailbirds-admin-record__actions">
                  <button type="button" onClick={() => beginEdit(record)}>Edit</button>
                  <a href={`/jailbirds/${record.id}`} target="_blank" rel="noreferrer">Public ↗</a>
                  <button
                    className="danger"
                    type="button"
                    disabled={deletingId === record.id}
                    onClick={() => remove(record)}
                  >
                    {deletingId === record.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="jailbirds-admin-empty">
            <strong>No active Jailbirds entries.</strong>
            <span>Publish a booking release below to add one to the public website.</span>
          </div>
        )}
      </section>

      <section className="jailbirds-admin-panel" ref={editorRef}>
        <div className="jailbirds-admin-panel__heading">
          <div>
            <span>{editing ? "Edit Release" : "New Release"}</span>
            <h2>{editing ? `Edit ${editing.full_name}` : "Publish booking entry"}</h2>
          </div>
          <strong>{editing ? "EDIT" : "72 HR"}</strong>
        </div>

        <form className="jailbirds-admin-form" key={editing?.id || "new"} onSubmit={submit}>
          <div className="jailbirds-admin-grid">
            <label>
              <span>Full Name</span>
              <input name="fullName" required maxLength={120} autoComplete="off" defaultValue={editing?.full_name || ""} />
            </label>

            <label>
              <span>Booking Number</span>
              <input name="bookingNumber" maxLength={80} autoComplete="off" defaultValue={editing?.booking_number || ""} />
            </label>

            <label>
              <span>Arrest Date / Time</span>
              <input name="arrestedAt" type="datetime-local" defaultValue={editing ? toDateTimeLocal(editing.arrested_at) : ""} />
            </label>

            <label className="jailbirds-admin-file">
              <span>{editing ? "Replace Booking Photograph" : "Booking Photograph"}</span>
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!editing} />
              <small>{editing ? "Leave blank to keep the current photograph." : "JPG, PNG, or WEBP · 8 MB maximum"}</small>
            </label>

            {editing?.imageUrl ? (
              <div className="jailbirds-admin-current-photo">
                <img src={editing.imageUrl} alt="Current booking photograph" />
                <div>
                  <span>Current Photograph</span>
                  <strong>Photo will remain unless you choose a replacement.</strong>
                </div>
              </div>
            ) : null}

            <label className="jailbirds-admin-wide">
              <span>Charges</span>
              <textarea
                name="charges"
                rows={8}
                maxLength={800}
                placeholder="Enter released arrest charges"
                defaultValue={editing?.charges || ""}
              />
            </label>
          </div>

          <div className="jailbirds-admin-actions">
            <p>
              {editing
                ? `This profile will still expire ${formatDate(editing.expires_at)}. Editing does not restart the 72-hour retention window.`
                : "Publication begins the 72-hour retention clock. The image and booking entry are both deleted when the retention period ends."}
            </p>
            <div className="jailbirds-admin-action-buttons">
              {editing ? <button className="secondary" type="button" onClick={cancelEdit} disabled={busy}>Cancel</button> : null}
              <button type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save Changes" : "Publish Jailbird"}</button>
            </div>
          </div>

          {status ? <div className="jailbirds-admin-status" role="status">{status}</div> : null}
        </form>
      </section>
    </div>
  );
}
