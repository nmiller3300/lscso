"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PortalDialog } from "./PortalDialog";

type Person = { id: string; display_name: string; rank: string; call_sign: string | null };
type Certification = { id: string; profile_id: string; name: string; status: string; issuer: string; certificate_number: string | null; issued_on: string | null; expires_on: string | null; notes: string | null };

const expirationPolicy: Record<string, string> = {
  "Advanced Criminal Investigations": "No expiration",
  "CPR / AED": "1 year",
  "Crisis Intervention Training": "1 year",
  "Defensive Tactics Instructor": "2 years",
  "Emergency Vehicle Operations": "No expiration",
  "Field Training Officer": "No expiration",
  "Firearms Specialist": "No expiration",
  "Internal Affairs Investigator": "No expiration",
  "Less-Lethal Certification": "1 year",
  "Pursuit Intervention Technique": "No expiration",
  "Stop the Bleed / First Aid": "1 year",
  "SWAT Operator": "No expiration",
  "Advanced Peace Officer": "No expiration",
  "Crime Scene Investigation": "No expiration",
  "Crisis Negotiator": "1 year",
  "Drug Recognition Expert": "1 year",
  "Evidence Handling": "No expiration",
  "Firearm Certification": "2 years",
  "FTO Instructor": "No expiration",
  "Interview & Interrogation": "1 year",
  "Less-Lethal Instructor": "1 year",
  "Radar / LIDAR": "No expiration",
  "Supervisor Certification": "No expiration",
  "Taser / Conducted Energy Weapon Certification": "1 year",
  "Basic Peace Officer": "No expiration",
  "Criminal Investigations": "No expiration",
  "De-Escalation Certification": "1 year",
  "DUI / Standardized Field Sobriety Testing": "No expiration",
  "EVOC Instructor": "2 years",
  "Firearms Instructor": "2 years",
  "General Instructor": "No expiration",
  "K-9 Handler": "No expiration",
  "OC Spray Certification": "No expiration",
  "Search & Rescue": "2 years",
  "SWAT Marksman": "1 year",
  "Traffic Enforcement": "No expiration",
};

export function CertificationWorkspace({ personnel, catalog, certifications, canManageCertifications }: { personnel: Person[]; catalog: string[]; certifications: Certification[]; canManageCertifications: boolean }) {
  const router = useRouter();
  const canIssue = canManageCertifications;
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Certification | null>(null);

  function toggleCertification(name: string) {
    setSelectedCertifications((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const targetProfileId = String(form.get("member") ?? "");
    const certificationName = String(form.get("certification") ?? "");
    if (!targetProfileId || (!canIssue && !certificationName) || (canIssue && !selectedCertifications.length)) {
      setNotice(canIssue ? "Select at least one certification to issue." : "Select a certification to request.");
      return;
    }

    setPending(true);
    const supabase = createClient() as any;
    const result = canIssue
      ? await supabase.rpc("issue_certifications_bulk", {
          target_profile_id: targetProfileId,
          certification_names: selectedCertifications,
          issued_date: String(form.get("issuedOn") ?? "") || new Date().toISOString().slice(0, 10),
          expiration_date: null,
          issue_notes: String(form.get("notes") ?? "").trim() || null,
        })
      : await supabase.rpc("request_certification", {
          target_profile_id: targetProfileId,
          certification_name: certificationName,
          request_notes: String(form.get("notes") ?? "").trim() || null,
        });

    setPending(false);
    if (result.error) { setNotice(result.error.message); return; }

    if (canIssue) {
      const count = Array.isArray(result.data) ? result.data.length : selectedCertifications.length;
      setNotice(`${count} certification${count === 1 ? "" : "s"} issued with LSCSO policy expiration and written to the personnel record.`);
      setSelectedCertifications([]);
      formElement.reset();
    } else {
      setNotice(`${certificationName} submitted for final issuance.`);
      formElement.reset();
    }
    router.refresh();
    window.setTimeout(() => setNotice(""), 4200);
  }

  async function confirmDeleteCertification() {
    if (!deleteTarget || !canIssue || pending) return;
    setPending(true);
    const target = deleteTarget;
    const result = await (createClient() as any).rpc("delete_certification", { certification_id: target.id });
    setPending(false);
    if (result.error) { setNotice(result.error.message); return; }
    setDeleteTarget(null);
    setNotice(`${target.name} removed from the personnel record.`);
    router.refresh();
    window.setTimeout(() => setNotice(""), 4200);
  }

  const deletePerson = deleteTarget ? personnel.find((item) => item.id === deleteTarget.profile_id) : null;

  return (
    <>
      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>{canIssue ? "Authorized issuance" : "Qualification recommendation"}</p><h2>{canIssue ? "Issue certification" : "Request certification"}</h2></div><span>{canIssue ? "Certification administration enabled" : "Final issuance requires delegated or leadership authority"}</span></div>
        <form onSubmit={submit}>
          <div className="portal-form-grid portal-form-grid--three">
            <label>Personnel member<select name="member" required defaultValue=""><option disabled value="">Select personnel</option>{personnel.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {person.rank}{person.call_sign ? ` · ${person.call_sign}` : ""}</option>)}</select></label>
            {!canIssue ? <label>Certification<select name="certification" required defaultValue=""><option disabled value="">Select certification</option>{catalog.map((name) => <option key={name}>{name}</option>)}</select></label> : null}
            {canIssue ? <div className="portal-form-protection"><strong>Expiration policy automated</strong><span>Each certification is assigned its required expiration from the LSCSO certification policy. Command cannot override the policy at issuance.</span></div> : <div className="portal-form-protection"><strong>Recommendation only</strong><span>This request does not add the certification until an authorized administrator issues it.</span></div>}
          </div>

          {canIssue ? <fieldset className="certification-picker"><legend>Select certifications <span>{selectedCertifications.length} selected</span></legend><div className="certification-picker__grid">{catalog.map((name) => <label className={selectedCertifications.includes(name) ? "is-selected" : undefined} key={name}><input checked={selectedCertifications.includes(name)} onChange={() => toggleCertification(name)} type="checkbox" /><span>{name}<small>{expirationPolicy[name] ?? "No expiration"}</small></span></label>)}</div></fieldset> : null}

          {canIssue ? <div className="portal-form-grid"><label>Issued on<input name="issuedOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><div className="portal-form-protection"><strong>Expiration date</strong><span>Automatically calculated from the selected certification(s) and issue date.</span></div></div> : null}
          <label className="portal-call-sign-field">Notes <span>Optional</span><textarea name="notes" rows={4} placeholder={canIssue ? "Issuance notes or qualification basis..." : "Training completion, evaluator recommendation, or supporting details..."} /></label>
          <div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending} type="submit">{pending ? "Saving…" : canIssue ? `Issue ${selectedCertifications.length || "selected"} certification${selectedCertifications.length === 1 ? "" : "s"}` : "Submit recommendation"}</button></div>
        </form>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Department certification record</p><h2>Certification activity</h2></div><span>{certifications.length} records</span></div>
        <div className="deputy-certification-list certification-activity-list">
          {certifications.map((certification) => {
            const person = personnel.find((item) => item.id === certification.profile_id);
            return <article key={certification.id}><span aria-hidden="true">{certification.status === "Current" ? "✓" : "…"}</span><div><strong>{certification.name}</strong><small>{person?.display_name ?? "Personnel"} · {certification.issuer}</small></div><div><small>Certificate number</small><strong>{certification.certificate_number ?? "Pending issuance"}</strong><small>{certification.expires_on ? `Expires ${certification.expires_on}` : certification.status === "Current" ? "No expiration" : ""}</small></div><b>{certification.status}</b>{canIssue ? <button className="certification-delete" disabled={pending} onClick={() => setDeleteTarget(certification)} type="button">Delete</button> : null}</article>;
          })}
          {!certifications.length ? <div className="portal-empty-state"><strong>No certification activity is on file.</strong></div> : null}
        </div>
      </section>

      <PortalDialog
        open={Boolean(deleteTarget)}
        onClose={() => { if (!pending) setDeleteTarget(null); }}
        eyebrow="Certification correction"
        title="Remove issued certification?"
        description="Use this only to correct an accidental issuance. The action is recorded in the protected personnel system."
        dismissOnBackdrop={false}
        footer={<><button className="portal-button portal-button--secondary" disabled={pending} onClick={() => setDeleteTarget(null)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={pending} onClick={confirmDeleteCertification} type="button">{pending ? "Removing…" : "Remove certification"}</button></>}
      >
        <div className="portal-form-protection"><strong>{deleteTarget?.name ?? "Certification"}</strong><span>{deletePerson?.display_name ?? "Personnel record"} · This does not silently rewrite certification history.</span></div>
      </PortalDialog>

      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
