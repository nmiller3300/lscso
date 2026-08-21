"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

type Person = { id: string; display_name: string; rank: string; call_sign: string | null };
type Certification = { id: string; profile_id: string; name: string; status: string; issuer: string; certificate_number: string | null; issued_on: string | null; expires_on: string | null; notes: string | null };

export function CertificationWorkspace({ personnel, catalog, certifications }: { personnel: Person[]; catalog: string[]; certifications: Certification[] }) {
  const router = useRouter();
  const profile = usePortalProfile();
  const isCommand = ["Executive", "Command"].includes(profile.access_tier);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const targetProfileId = String(form.get("member") ?? "");
    const certificationName = String(form.get("certification") ?? "");
    if (!targetProfileId || !certificationName) return;
    setPending(true);
    const supabase = createClient() as any;
    const result = isCommand
      ? await supabase.rpc("issue_certification", {
          target_profile_id: targetProfileId,
          certification_name: certificationName,
          issued_date: String(form.get("issuedOn") ?? "") || new Date().toISOString().slice(0, 10),
          expiration_date: String(form.get("expiresOn") ?? "") || null,
          issue_notes: String(form.get("notes") ?? "").trim() || null,
        })
      : await supabase.rpc("request_certification", {
          target_profile_id: targetProfileId,
          certification_name: certificationName,
          request_notes: String(form.get("notes") ?? "").trim() || null,
        });
    setPending(false);
    if (result.error) { setNotice(result.error.message); return; }
    const generatedNumber = result.data?.certificate_number;
    setNotice(isCommand ? `${certificationName} issued${generatedNumber ? ` as ${generatedNumber}` : ""} and written to the personnel record.` : `${certificationName} submitted to Command for final issuance.`);
    router.refresh();
    window.setTimeout(() => setNotice(""), 4200);
  }

  return (
    <>
      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>{isCommand ? "Command issuance" : "Supervisor recommendation"}</p><h2>{isCommand ? "Issue certification" : "Request certification"}</h2></div><span>{isCommand ? "Command and above issue final certifications" : "Final certification remains with Command"}</span></div>
        <form onSubmit={submit}>
          <div className="portal-form-grid portal-form-grid--three">
            <label>Personnel member<select name="member" required defaultValue=""><option disabled value="">Select personnel</option>{personnel.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {person.rank}{person.call_sign ? ` · ${person.call_sign}` : ""}</option>)}</select></label>
            <label>Certification<select name="certification" required defaultValue=""><option disabled value="">Select certification</option>{catalog.map((name) => <option key={name}>{name}</option>)}</select></label>
            {isCommand ? <div className="portal-form-protection"><strong>Certificate number automated</strong><span>Supabase assigns a unique LSCSO certificate number when Command issues the credential.</span></div> : <div className="portal-form-protection"><strong>Recommendation only</strong><span>This request does not add the certification until Command issues it.</span></div>}
          </div>
          {isCommand ? <div className="portal-form-grid"><label>Issued on<input name="issuedOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Expiration date<input name="expiresOn" type="date" /></label></div> : null}
          <label className="portal-call-sign-field">Notes <span>Optional</span><textarea name="notes" rows={4} placeholder={isCommand ? "Issuance notes or qualification basis..." : "Training completion, evaluator recommendation, or supporting details..."} /></label>
          <div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending} type="submit">{pending ? "Saving…" : isCommand ? "Issue certification" : "Submit recommendation"}</button></div>
        </form>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Department certification record</p><h2>Certification activity</h2></div><span>{certifications.length} records</span></div>
        <div className="deputy-certification-list">
          {certifications.map((certification) => {
            const person = personnel.find((item) => item.id === certification.profile_id);
            return <article key={certification.id}><span aria-hidden="true">{certification.status === "Current" ? "✓" : "…"}</span><div><strong>{certification.name}</strong><small>{person?.display_name ?? "Personnel"} · {certification.issuer}</small></div><div><small>Certificate number</small><strong>{certification.certificate_number ?? "Pending issuance"}</strong></div><b>{certification.status}</b></article>;
          })}
          {!certifications.length ? <div className="portal-empty-state"><strong>No certification activity is on file.</strong></div> : null}
        </div>
      </section>
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
