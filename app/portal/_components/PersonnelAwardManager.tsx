"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PortalDialog } from "./PortalDialog";

const medalCatalog = [
  "Medal of Valor",
  "Medal of Merit",
  "Life Saving Award",
  "Distinguished Service Award",
] as const;

function localDate() {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 10);
}

export function PersonnelAwardManager({
  profileId,
  displayName,
  canIssue,
}: {
  profileId: string;
  displayName: string;
  canIssue: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (!canIssue) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const form = new FormData(event.currentTarget);
    const awardType = String(form.get("awardType") ?? "");
    const citation = String(form.get("citation") ?? "").trim();
    const awardDate = String(form.get("awardDate") ?? "");

    if (!medalCatalog.includes(awardType as (typeof medalCatalog)[number])) {
      setError("Select an approved LSCSO medal.");
      return;
    }
    if (citation.length < 10) {
      setError("Enter a medal citation of at least 10 characters.");
      return;
    }
    if (!awardDate) {
      setError("Select the award date.");
      return;
    }

    setSaving(true);
    setError("");
    const { error: awardError } = await (createClient() as any).rpc("issue_personnel_award", {
      target_profile_id: profileId,
      award_type: awardType,
      citation_text: citation,
      award_date: awardDate,
      asset_path: null,
    });
    setSaving(false);

    if (awardError) {
      setError(awardError.message ?? "The medal could not be issued.");
      return;
    }

    setOpen(false);
    setNotice(`${awardType} issued to ${displayName}.`);
    router.refresh();
    window.setTimeout(() => setNotice(""), 5000);
  }

  return (
    <>
      <section className="portal-panel command-v2-launcher">
        <div className="portal-panel-heading"><div><p>Department recognition</p><h2>Awards management</h2></div></div>
        <p className="command-v2-compact-copy">Issue an approved LSCSO medal directly to this personnel record. The issuing command member and citation are recorded automatically.</p>
        <div className="command-v2-action-row"><button className="portal-button portal-button--primary" onClick={() => { setError(""); setOpen(true); }} type="button">Issue medal</button></div>
      </section>

      <PortalDialog
        open={open}
        onClose={() => { if (!saving) setOpen(false); }}
        eyebrow="Official recognition"
        title={`Issue Medal · ${displayName}`}
        description="Select an approved department medal and record the official citation."
        dismissOnBackdrop={!saving}
        footer={<><button className="portal-button portal-button--secondary" disabled={saving} onClick={() => setOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={saving} form="personnel-award-form" type="submit">{saving ? "Issuing…" : "Issue Medal"}</button></>}
      >
        <form className="portal-dialog-form" id="personnel-award-form" onSubmit={submit}>
          <div className="portal-form-grid portal-form-grid--two">
            <label>Medal<select name="awardType" defaultValue="Medal of Merit">{medalCatalog.map((medal) => <option key={medal}>{medal}</option>)}</select></label>
            <label>Award date<input name="awardDate" type="date" required defaultValue={localDate()} /></label>
          </div>
          <label>Official citation<textarea name="citation" required minLength={10} maxLength={6000} rows={6} placeholder="Document the service, conduct, or action for which this medal is being awarded." /></label>
          <div className="portal-form-protection"><strong>Permanent personnel record</strong><span>Issued medals are retained in the member&apos;s recognition history and personnel-file exports.</span></div>
          {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
        </form>
      </PortalDialog>

      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
