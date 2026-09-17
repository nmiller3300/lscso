"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PortalDialog } from "./PortalDialog";

type Person = { id: string; display_name: string; rank: string; call_sign: string | null };
type Certification = { id: string; profile_id: string; name: string; status: string; issuer: string; certificate_number: string | null; issued_on: string | null; expires_on: string | null; notes: string | null };
type ActivityFilter = "attention" | "current" | "history";

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

const certificationCategories = [
  "Core & Medical",
  "Patrol & Traffic",
  "Investigations",
  "Firearms & Tactical",
  "Instruction & Leadership",
  "Specialty",
] as const;

function categoryFor(name: string) {
  const value = name.toLowerCase();
  if (/basic peace|advanced peace|cpr|first aid|stop the bleed|crisis intervention|de-escalation/.test(value)) return "Core & Medical";
  if (/vehicle|pursuit|traffic|radar|lidar|dui|sobriety|oc spray|taser|conducted energy/.test(value)) return "Patrol & Traffic";
  if (/investigat|crime scene|evidence|interview|interrogation|drug recognition|internal affairs|negotiator/.test(value)) return "Investigations";
  if (/firearm|swat|less-lethal|defensive tactics|marksman/.test(value)) return "Firearms & Tactical";
  if (/instructor|field training officer|supervisor certification/.test(value)) return "Instruction & Leadership";
  return "Specialty";
}

function dateLabel(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function CertificationWorkspace({ personnel, catalog, certifications, canManageCertifications }: { personnel: Person[]; catalog: string[]; certifications: Certification[]; canManageCertifications: boolean }) {
  const router = useRouter();
  const canIssue = canManageCertifications;
  const today = new Date().toISOString().slice(0, 10);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Certification | null>(null);
  const [targetProfileId, setTargetProfileId] = useState("");
  const [catalogCategory, setCatalogCategory] = useState<string>("Core & Medical");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("attention");
  const [activityMember, setActivityMember] = useState("");
  const [activityQuery, setActivityQuery] = useState("");
  const [activityLimit, setActivityLimit] = useState(20);

  const peopleById = useMemo(() => new Map(personnel.map((person) => [person.id, person])), [personnel]);

  const unavailableNames = useMemo(() => new Set(
    certifications
      .filter((item) => item.profile_id === targetProfileId && ["Current", "Requested", "Pending"].includes(item.status))
      .map((item) => item.name),
  ), [certifications, targetProfileId]);

  const availableCatalog = useMemo(
    () => catalog.filter((name) => !unavailableNames.has(name)),
    [catalog, unavailableNames],
  );

  const catalogCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const category of certificationCategories) counts.set(category, 0);
    for (const name of availableCatalog) {
      const category = categoryFor(name);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return counts;
  }, [availableCatalog]);

  const visibleCatalog = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return availableCatalog.filter((name) => {
      if (query) return name.toLowerCase().includes(query);
      return categoryFor(name) === catalogCategory;
    });
  }, [availableCatalog, catalogCategory, catalogQuery]);

  const attentionCertifications = useMemo(() => certifications.filter((item) => {
    if (["Requested", "Pending"].includes(item.status)) return true;
    return item.status === "Current" && Boolean(item.expires_on) && String(item.expires_on) <= new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  }), [certifications]);

  const currentCount = certifications.filter((item) => item.status === "Current").length;
  const historyCount = certifications.filter((item) => ["Expired", "Revoked", "Denied"].includes(item.status)).length;

  const filteredActivity = useMemo(() => {
    const query = activityQuery.trim().toLowerCase();
    return certifications.filter((item) => {
      if (activityMember && item.profile_id !== activityMember) return false;
      const person = peopleById.get(item.profile_id);
      if (query && !`${item.name} ${person?.display_name ?? ""} ${person?.rank ?? ""} ${item.certificate_number ?? ""} ${item.issuer}`.toLowerCase().includes(query)) return false;
      if (activityFilter === "attention") {
        if (["Requested", "Pending"].includes(item.status)) return true;
        return item.status === "Current" && Boolean(item.expires_on) && String(item.expires_on) <= new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      }
      if (activityFilter === "current") return item.status === "Current";
      return ["Expired", "Revoked", "Denied"].includes(item.status);
    });
  }, [activityFilter, activityMember, activityQuery, certifications, peopleById]);

  const visibleActivity = filteredActivity.slice(0, activityLimit);

  function toggleCertification(name: string) {
    setSelectedCertifications((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  function handleMemberChange(profileId: string) {
    setTargetProfileId(profileId);
    setSelectedCertifications([]);
    setCatalogQuery("");
  }

  function selectVisible() {
    setSelectedCertifications((current) => Array.from(new Set([...current, ...visibleCatalog])));
  }

  function changeActivityFilter(filter: ActivityFilter) {
    setActivityFilter(filter);
    setActivityLimit(20);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selectedProfileId = String(form.get("member") ?? "");
    const certificationName = String(form.get("certification") ?? "");
    if (!selectedProfileId || (!canIssue && !certificationName) || (canIssue && !selectedCertifications.length)) {
      setNotice(canIssue ? "Select at least one certification to issue." : "Select a certification to request.");
      return;
    }

    setPending(true);
    const supabase = createClient() as any;
    const result = canIssue
      ? await supabase.rpc("issue_certifications_bulk", {
          target_profile_id: selectedProfileId,
          certification_names: selectedCertifications,
          issued_date: String(form.get("issuedOn") ?? "") || today,
          expiration_date: null,
          issue_notes: String(form.get("notes") ?? "").trim() || null,
        })
      : await supabase.rpc("request_certification", {
          target_profile_id: selectedProfileId,
          certification_name: certificationName,
          request_notes: String(form.get("notes") ?? "").trim() || null,
        });

    setPending(false);
    if (result.error) { setNotice(result.error.message); return; }

    if (canIssue) {
      const count = Array.isArray(result.data) ? result.data.length : selectedCertifications.length;
      setNotice(`${count} certification${count === 1 ? "" : "s"} issued.`);
      setSelectedCertifications([]);
      setTargetProfileId("");
      setCatalogQuery("");
      formElement.reset();
    } else {
      setNotice(`${certificationName} submitted for final issuance.`);
      setTargetProfileId("");
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

  const deletePerson = deleteTarget ? peopleById.get(deleteTarget.profile_id) : null;

  return (
    <>
      <section className="portal-panel certification-issue-panel">
        <div className="portal-panel-heading"><div><p>{canIssue ? "Authorized issuance" : "Qualification recommendation"}</p><h2>{canIssue ? "Issue certification" : "Request certification"}</h2></div><span>{canIssue ? "Choose a member, then only relevant options remain" : "Final issuance requires authorized review"}</span></div>
        <form onSubmit={submit}>
          <div className="portal-form-grid portal-form-grid--three">
            <label>Personnel member<select name="member" required value={targetProfileId} onChange={(event) => handleMemberChange(event.target.value)}><option disabled value="">Select personnel</option>{personnel.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {person.rank}{person.call_sign ? ` · ${person.call_sign}` : ""}</option>)}</select></label>
            {!canIssue ? <label>Certification<select name="certification" required defaultValue=""><option disabled value="">Select certification</option>{certificationCategories.map((category) => {
              const names = availableCatalog.filter((name) => categoryFor(name) === category);
              return names.length ? <optgroup key={category} label={category}>{names.map((name) => <option key={name}>{name}</option>)}</optgroup> : null;
            })}</select></label> : null}
            {canIssue ? <div className="portal-form-protection"><strong>Already-held certifications are hidden</strong><span>Select a member first. Current and already-pending certifications are removed from the picker automatically.</span></div> : <div className="portal-form-protection"><strong>Recommendation only</strong><span>This request does not add the certification until an authorized administrator issues it.</span></div>}
          </div>

          {canIssue ? <fieldset className="certification-picker">
            <legend><span>Select certifications</span><b>{selectedCertifications.length} selected</b></legend>
            <div className="certification-picker__toolbar">
              <input aria-label="Search certifications" onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Search certifications..." type="search" value={catalogQuery} />
              <div className="certification-picker__actions"><button disabled={!visibleCatalog.length} onClick={selectVisible} type="button">Select visible</button><button disabled={!selectedCertifications.length} onClick={() => setSelectedCertifications([])} type="button">Clear</button></div>
            </div>
            {!catalogQuery ? <div className="certification-category-tabs">{certificationCategories.map((category) => <button className={catalogCategory === category ? "is-active" : undefined} key={category} onClick={() => setCatalogCategory(category)} type="button"><span>{category}</span><b>{catalogCounts.get(category) ?? 0}</b></button>)}</div> : null}
            {!targetProfileId ? <div className="certification-picker__empty"><strong>Select a personnel member first.</strong><span>The picker will automatically hide qualifications already on that member’s record.</span></div> : visibleCatalog.length ? <div className="certification-picker__grid">{visibleCatalog.map((name) => <label className={selectedCertifications.includes(name) ? "is-selected" : undefined} key={name}><input checked={selectedCertifications.includes(name)} onChange={() => toggleCertification(name)} type="checkbox" /><span>{name}<small>{expirationPolicy[name] ?? "No expiration"}</small></span></label>)}</div> : <div className="certification-picker__empty"><strong>No certifications match this view.</strong><span>Try another category or search term.</span></div>}
          </fieldset> : null}

          {canIssue ? <div className="portal-form-grid"><label>Issued on<input name="issuedOn" type="date" defaultValue={today} /></label><div className="portal-form-protection"><strong>Expiration date</strong><span>Calculated automatically from LSCSO policy for every selected certification.</span></div></div> : null}
          <label className="portal-call-sign-field">Notes <span>Optional</span><textarea name="notes" rows={3} placeholder={canIssue ? "Issuance notes or qualification basis..." : "Training completion, evaluator recommendation, or supporting details..."} /></label>
          <div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending || (canIssue && !selectedCertifications.length)} type="submit">{pending ? "Saving…" : canIssue ? `Issue ${selectedCertifications.length || "selected"} certification${selectedCertifications.length === 1 ? "" : "s"}` : "Submit recommendation"}</button></div>
        </form>
      </section>

      <section className="portal-panel certification-record-panel">
        <div className="portal-panel-heading"><div><p>Department certification record</p><h2>Certification activity</h2></div><span>{certifications.length} total records</span></div>

        <div className="certification-summary-grid">
          <button className={activityFilter === "attention" ? "is-active" : undefined} onClick={() => changeActivityFilter("attention")} type="button"><span>Needs attention</span><strong>{attentionCertifications.length}</strong><small>Pending or expiring within 60 days</small></button>
          <button className={activityFilter === "current" ? "is-active" : undefined} onClick={() => changeActivityFilter("current")} type="button"><span>Current</span><strong>{currentCount}</strong><small>Active department qualifications</small></button>
          <button className={activityFilter === "history" ? "is-active" : undefined} onClick={() => changeActivityFilter("history")} type="button"><span>History</span><strong>{historyCount}</strong><small>Expired, revoked, or denied</small></button>
        </div>

        <div className="certification-record-filters">
          <input aria-label="Search certification activity" onChange={(event) => { setActivityQuery(event.target.value); setActivityLimit(20); }} placeholder="Search member, certification, or certificate #..." type="search" value={activityQuery} />
          <select aria-label="Filter certification activity by personnel" onChange={(event) => { setActivityMember(event.target.value); setActivityLimit(20); }} value={activityMember}><option value="">All personnel</option>{personnel.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {person.rank}</option>)}</select>
        </div>

        <div className="deputy-certification-list certification-activity-list">
          {visibleActivity.map((certification) => {
            const person = peopleById.get(certification.profile_id);
            const isOverdue = certification.status === "Current" && Boolean(certification.expires_on) && String(certification.expires_on) < today;
            return <article className={isOverdue ? "is-overdue" : undefined} key={certification.id}><span aria-hidden="true">{certification.status === "Current" && !isOverdue ? "✓" : "!"}</span><div><strong>{certification.name}</strong><small>{person?.display_name ?? "Personnel"} · {person?.rank ?? ""}</small></div><div><small>{certification.certificate_number ? "Certificate" : "Record"}</small><strong>{certification.certificate_number ?? certification.issuer}</strong><small>{certification.expires_on ? `${isOverdue ? "Expired" : "Expires"} ${dateLabel(certification.expires_on)}` : certification.status === "Current" ? "No expiration" : certification.issuer}</small></div><b>{isOverdue ? "Expired" : certification.status}</b>{canIssue ? <button className="certification-delete" disabled={pending} onClick={() => setDeleteTarget(certification)} type="button">Delete</button> : null}</article>;
          })}
          {!filteredActivity.length ? <div className="portal-empty-state"><strong>No certification records match this view.</strong><span>Change the status view, member, or search term.</span></div> : null}
        </div>

        {filteredActivity.length > visibleActivity.length ? <div className="certification-load-more"><button className="portal-button portal-button--secondary" onClick={() => setActivityLimit((current) => current + 20)} type="button">Show 20 more · {filteredActivity.length - visibleActivity.length} remaining</button></div> : null}
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
