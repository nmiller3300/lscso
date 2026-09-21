"use client";

import { FormEvent, useState } from "react";

export function JailbirdsUploader() {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/portal/jailbirds", {
        method: "POST",
        body: new FormData(form),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Upload failed.");

      form.reset();
      setStatus("Published. This entry will automatically expire 72 hours after upload.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="jailbirds-admin-form" onSubmit={submit}>
      <div className="jailbirds-admin-grid">
        <label>
          <span>Full Name</span>
          <input name="fullName" required maxLength={120} autoComplete="off" />
        </label>

        <label>
          <span>Booking Number</span>
          <input name="bookingNumber" maxLength={80} autoComplete="off" />
        </label>

        <label>
          <span>Arrest Date / Time</span>
          <input name="arrestedAt" type="datetime-local" />
        </label>

        <label className="jailbirds-admin-file">
          <span>Booking Photograph</span>
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
          <small>JPG, PNG, or WEBP · 8 MB maximum</small>
        </label>

        <label className="jailbirds-admin-wide">
          <span>Charges</span>
          <textarea name="charges" rows={5} maxLength={800} placeholder="Enter released arrest charges" />
        </label>
      </div>

      <div className="jailbirds-admin-actions">
        <p>
          Publication begins the 72-hour retention clock. The image and booking entry are both deleted when the retention period ends.
        </p>
        <button type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish Jailbird"}</button>
      </div>

      {status ? <div className="jailbirds-admin-status" role="status">{status}</div> : null}
    </form>
  );
}
