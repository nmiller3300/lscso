"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PortalDialog } from "../../../../_components/PortalDialog";
import { createClient } from "@/lib/supabase/client";

type ActiveTrainingRecord = {
  id: string;
  programType: string;
  phase: string;
  status: string;
  progressPercent: number;
  evaluatorProfileId: string | null;
  trainerName: string | null;
};

type Props = {
  memberId: string;
  memberName: string;
  currentProfileId: string;
  canManageTraining: boolean;
  activeRecords: ActiveTrainingRecord[];
};

const categories = ["Academy", "FTO", "Remedial", "Continuing Education", "Leadership", "Specialty", "Other"];
const statuses = ["Not Started", "In Progress", "Needs Improvement", "Complete", "Released", "Withdrawn"];

function TrainingProgressEditor({ record, onSaved }: { record: ActiveTrainingRecord; onSaved: (message: string) => void }) {
  const [phase, setPhase] = useState(record.phase);
  const [status, setStatus] = useState(record.status);
  const [progress, setProgress] = useState(record.progressPercent);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving || !phase.trim()) return;
    setSaving(true);
    const supabase = createClient() as any;
    const { error } = await supabase.rpc("roster_update_training_progress", {
      p_training_id: record.id,
      p_phase: phase.trim(),
      p_status: status,
      p_progress_percent: Number(progress),
      p_notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      onSaved(error.message ?? "Training progress could not be updated.");
      return;
    }
    setNotes("");
    onSaved("Training progress updated.");
  }

  return (
    <article className="training-progress-editor">
      <div className="training-progress-editor__heading">
        <div><span>{record.programType}</span><strong>{record.trainerName ? `Trainer: ${record.trainerName}` : "Trainer unassigned"}</strong></div>
        <b>{progress}%</b>
      </div>
      <div className="portal-form-grid portal-form-grid--three">
        <label>Phase<input value={phase} onChange={(event) => setPhase(event.target.value)} /></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Progress<input min={0} max={100} type="number" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label>
      </div>
      <label className="training-progress-editor__note">Progress / evaluation note<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="command-v2-action-row"><button className="portal-button portal-button--primary" disabled={saving || !phase.trim()} onClick={() => void save()} type="button">{saving ? "Saving…" : "Update Training"}</button></div>
    </article>
  );
}

export function PersonnelTrainingControls({ memberId, memberName, currentProfileId, canManageTraining, activeRecords }: Props) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [requirementOpen, setRequirementOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  function finish(message: string) {
    setNotice(message);
    router.refresh();
    window.setTimeout(() => setNotice(""), 5000);
  }

  async function addHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    const supabase = createClient() as any;
    const { error } = await supabase.rpc("record_personnel_training_history", {
      p_profile_id: memberId,
      p_record_type: String(form.get("recordType") ?? "Prior / Lateral Training"),
      p_category: String(form.get("category") ?? "Other"),
      p_title: String(form.get("title") ?? "").trim(),
      p_provider: String(form.get("provider") ?? "").trim(),
      p_completed_on: String(form.get("completedOn") ?? "") || null,
      p_verification_status: String(form.get("verificationStatus") ?? "Verified"),
      p_notes: String(form.get("notes") ?? "").trim() || null,
      p_source_document_reference: String(form.get("sourceReference") ?? "").trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setNotice(error.message ?? "Training history could not be recorded.");
      return;
    }
    setHistoryOpen(false);
    finish("Training history recorded.");
  }

  async function setRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    const supabase = createClient() as any;
    const { error } = await supabase.rpc("set_training_requirement_disposition", {
      p_profile_id: memberId,
      p_requirement: String(form.get("requirement") ?? "Academy"),
      p_disposition: String(form.get("disposition") ?? "Required"),
      p_reason: String(form.get("reason") ?? "").trim(),
    });
    setSubmitting(false);
    if (error) {
      setNotice(error.message ?? "Training requirement could not be updated.");
      return;
    }
    setRequirementOpen(false);
    finish("Entry training requirement updated.");
  }

  const editableRecords = activeRecords.filter((record) => canManageTraining || record.evaluatorProfileId === currentProfileId);

  return (
    <>
      {canManageTraining ? (
        <section className="portal-panel training-admin-actions">
          <div className="portal-panel-heading"><div><p>Training administration</p><h2>Record Actions</h2></div></div>
          <div className="personnel-record-qol-actions">
            <button className="portal-button portal-button--primary" onClick={() => setHistoryOpen(true)} type="button">Add Training Record</button>
            <button className="portal-button portal-button--secondary" onClick={() => setRequirementOpen(true)} type="button">Set Entry Requirement</button>
          </div>
        </section>
      ) : null}

      {editableRecords.length ? (
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Active training</p><h2>Progress Updates</h2></div><span>{editableRecords.length}</span></div>
          <div className="training-progress-editors">
            {editableRecords.map((record) => <TrainingProgressEditor key={record.id} record={record} onSaved={finish} />)}
          </div>
        </section>
      ) : null}

      <PortalDialog
        open={historyOpen}
        onClose={() => { if (!submitting) setHistoryOpen(false); }}
        eyebrow="Permanent personnel record"
        title={`Add Training · ${memberName}`}
        description="Record completed LSCSO training or verified prior/lateral training."
        dismissOnBackdrop={!submitting}
        footer={<><button className="portal-button portal-button--secondary" disabled={submitting} onClick={() => setHistoryOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={submitting} form="training-history-form" type="submit">{submitting ? "Saving…" : "Add Record"}</button></>}
      >
        <form className="portal-dialog-form" id="training-history-form" onSubmit={addHistory}>
          <div className="portal-form-grid portal-form-grid--two">
            <label>Record type<select name="recordType" defaultValue="Prior / Lateral Training"><option>Department Training</option><option>Prior / Lateral Training</option></select></label>
            <label>Category<select name="category" defaultValue="Other">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Training / course title<input name="title" required /></label>
            <label>Provider / agency<input name="provider" required /></label>
            <label>Completion date <span>Optional</span><input name="completedOn" type="date" /></label>
            <label>Record status<select name="verificationStatus" defaultValue="Verified"><option>Completed</option><option>Released</option><option>Verified</option><option>Accepted as Equivalent</option><option>Recorded for History Only</option></select></label>
          </div>
          <label>Source / document reference <span>Optional</span><input name="sourceReference" placeholder="Certificate, transfer packet, academy record, etc." /></label>
          <label>Notes <span>Optional</span><textarea name="notes" rows={4} /></label>
        </form>
      </PortalDialog>

      <PortalDialog
        open={requirementOpen}
        onClose={() => { if (!submitting) setRequirementOpen(false); }}
        eyebrow="Entry training"
        title={`Training Requirement · ${memberName}`}
        description="Record whether Academy or FTO is required, completed, waived, or not applicable."
        dismissOnBackdrop={!submitting}
        footer={<><button className="portal-button portal-button--secondary" disabled={submitting} onClick={() => setRequirementOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={submitting} form="training-requirement-form" type="submit">{submitting ? "Saving…" : "Save Requirement"}</button></>}
      >
        <form className="portal-dialog-form" id="training-requirement-form" onSubmit={setRequirement}>
          <div className="portal-form-grid portal-form-grid--two">
            <label>Requirement<select name="requirement"><option>Academy</option><option>FTO</option></select></label>
            <label>Disposition<select name="disposition"><option>Required</option><option>In Progress</option><option>Completed</option><option>Not Required</option><option>Waived</option></select></label>
          </div>
          <label>Reason<textarea name="reason" required rows={4} placeholder="Example: Not Required — appointed at Command rank." /></label>
        </form>
      </PortalDialog>

      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
