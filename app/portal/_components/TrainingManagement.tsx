"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Person = {
  id: string;
  personnelId: string;
  displayName: string;
  rank: string;
  callSign: string | null;
  ftoQualified: boolean;
};

type Trainer = Person & {
  leadershipTrainer: boolean;
};

type TrainingRecord = {
  id: string;
  traineeId: string;
  trainerId: string | null;
  traineeName: string;
  trainerName: string | null;
  programType: string;
  phase: string;
  status: string;
  progressPercent: number;
};

const programs = ["Academy", "FTO", "Remedial", "Continuing Education"];
const statuses = ["Not Started", "In Progress", "Needs Improvement", "Complete", "Released", "Withdrawn"];

export function TrainingManagement({
  personnel,
  trainers,
  records,
  canManageTraining,
}: {
  personnel: Person[];
  trainers: Trainer[];
  records: TrainingRecord[];
  canManageTraining: boolean;
}) {
  const router = useRouter();
  const supabase = createClient() as any;
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState(records[0]?.id ?? "");
  const selectedRecord = useMemo(() => records.find((record) => record.id === selectedRecordId) ?? records[0], [records, selectedRecordId]);

  async function run(operation: () => Promise<{ error?: { message?: string } | null }>, success: string) {
    if (pending) return;
    setPending(true);
    setNotice("");
    try {
      const result = await operation();
      if (result.error) throw new Error(result.error.message || "The training update could not be completed.");
      setNotice(success);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The training update could not be completed.");
    } finally {
      setPending(false);
    }
  }

  async function startTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const trainee = String(form.get("trainee") ?? "");
    const trainer = String(form.get("trainer") ?? "");
    const program = String(form.get("program") ?? "FTO");
    const phase = String(form.get("phase") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    if (!trainee || !trainer || !phase) return setNotice("Choose a trainee, trainer, and current phase.");
    await run(
      () => supabase.rpc("start_training_record", {
        p_trainee_profile_id: trainee,
        p_trainer_profile_id: trainer,
        p_program_type: program,
        p_phase: phase,
        p_notes: notes || null,
      }),
      "Training assignment started.",
    );
  }

  async function updateTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecord) return setNotice("Select a training record first.");
    const form = new FormData(event.currentTarget);
    await run(
      () => supabase.rpc("update_training_record", {
        p_training_id: selectedRecord.id,
        p_trainer_profile_id: String(form.get("trainer") ?? selectedRecord.trainerId ?? ""),
        p_phase: String(form.get("phase") ?? selectedRecord.phase).trim(),
        p_status: String(form.get("status") ?? selectedRecord.status),
        p_progress_percent: Number(form.get("progress") ?? selectedRecord.progressPercent),
        p_notes: String(form.get("notes") ?? "").trim() || null,
      }),
      "Training progress updated.",
    );
  }

  async function changeFto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profileId = String(form.get("member") ?? "");
    const qualified = String(form.get("action") ?? "grant") === "grant";
    const reason = String(form.get("reason") ?? "").trim();
    const person = personnel.find((item) => item.id === profileId);
    if (!profileId) return setNotice("Choose a member first.");
    await run(
      () => supabase.rpc("set_fto_qualification", {
        p_profile_id: profileId,
        p_qualified: qualified,
        p_reason: reason || null,
      }),
      `${person?.displayName ?? "Personnel"} ${qualified ? "is now FTO qualified" : "is no longer FTO qualified"}.`,
    );
  }

  if (!canManageTraining) return null;

  return (
    <div className="command-v2-workspace-grid" style={{ marginBottom: 16 }}>
      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Training assignment</p><h2>Start training</h2></div></div>
        <form onSubmit={startTraining}>
          <div className="portal-form-grid">
            <label>Trainee<select name="trainee" required defaultValue=""><option value="" disabled>Select trainee</option>{personnel.map((person) => <option key={person.id} value={person.id}>{person.callSign ?? person.personnelId} · {person.displayName} · {person.rank}</option>)}</select></label>
            <label>Trainer<select name="trainer" required defaultValue=""><option value="" disabled>Select trainer</option>{trainers.map((person) => <option key={person.id} value={person.id}>{person.callSign ?? person.personnelId} · {person.displayName} · {person.rank}</option>)}</select></label>
            <label>Program<select name="program" defaultValue="FTO">{programs.map((program) => <option key={program}>{program}</option>)}</select></label>
            <label>Current phase<input name="phase" required placeholder="Orientation, Phase 1, Academy Block 1..." /></label>
          </div>
          <label className="portal-call-sign-field">Notes <span>Optional</span><textarea name="notes" rows={3} placeholder="Assignment notes or expectations" /></label>
          <div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending} type="submit">Assign trainee</button></div>
        </form>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>FTO qualification</p><h2>Manage FTOs</h2></div></div>
        <form onSubmit={changeFto}>
          <div className="portal-form-grid">
            <label>Member<select name="member" required defaultValue=""><option value="" disabled>Select member</option>{personnel.map((person) => <option key={person.id} value={person.id}>{person.callSign ?? person.personnelId} · {person.displayName} · {person.ftoQualified ? "FTO Qualified" : "Not FTO Qualified"}</option>)}</select></label>
            <label>Action<select name="action" defaultValue="grant"><option value="grant">Grant FTO qualification</option><option value="remove">Remove FTO qualification</option></select></label>
          </div>
          <label className="portal-call-sign-field">Reason <span>Optional</span><textarea name="reason" rows={3} placeholder="Qualification, reassignment, or removal note" /></label>
          <div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending} type="submit">Apply FTO change</button></div>
        </form>
      </section>

      <section className="portal-panel" style={{ gridColumn: "1 / -1" }}>
        <div className="portal-panel-heading"><div><p>Training progression</p><h2>Update active training</h2></div><span>{records.length} active</span></div>
        {records.length && selectedRecord ? (
          <form key={selectedRecord.id} onSubmit={updateTraining}>
            <div className="portal-form-grid portal-form-grid--three">
              <label>Training record<select value={selectedRecord.id} onChange={(event) => setSelectedRecordId(event.target.value)}>{records.map((record) => <option key={record.id} value={record.id}>{record.traineeName} · {record.programType}</option>)}</select></label>
              <label>Trainer<select name="trainer" defaultValue={selectedRecord.trainerId ?? ""}><option value="" disabled>Select trainer</option>{trainers.map((person) => <option key={person.id} value={person.id}>{person.displayName} · {person.rank}</option>)}</select></label>
              <label>Status<select name="status" defaultValue={selectedRecord.status}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label>Phase<input name="phase" defaultValue={selectedRecord.phase} required /></label>
              <label>Progress %<input name="progress" defaultValue={selectedRecord.progressPercent} min={0} max={100} type="number" required /></label>
            </div>
            <label className="portal-call-sign-field">Evaluation / progress note <span>Optional</span><textarea name="notes" rows={4} placeholder="What was completed, observed, or needs follow-up" /></label>
            <div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending} type="submit">Save training progress</button></div>
          </form>
        ) : <div className="portal-empty-state"><strong>No active training records.</strong><span>Use Start training to create the first trainee assignment.</span></div>}
      </section>

      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </div>
  );
}
