"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PortalDialog } from "../../_components/PortalDialog";
import { createClient } from "@/lib/supabase/client";

type PersonnelOption = {
  id: string;
  personnelId: string;
  displayName: string;
  rank: string;
  callSign: string | null;
  ftoQualified: boolean;
};

type Props = {
  personnel: PersonnelOption[];
};

const programs = ["Academy", "FTO", "Remedial", "Continuing Education"];
const phases = ["Orientation", "Observation", "Supervised Patrol", "Evaluation", "Remedial", "Release Review"];

function label(person: PersonnelOption) {
  return `${person.callSign ?? person.personnelId} · ${person.rank} ${person.displayName}`;
}

export function TrainingAssignmentLauncher({ personnel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [program, setProgram] = useState("FTO");
  const [traineeId, setTraineeId] = useState(personnel[0]?.id ?? "");
  const [trainerId, setTrainerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const trainers = useMemo(() => personnel.filter((person) => person.id !== traineeId && (program !== "FTO" || person.ftoQualified)), [personnel, program, traineeId]);

  useEffect(() => {
    if (!trainers.some((person) => person.id === trainerId)) setTrainerId(trainers[0]?.id ?? "");
  }, [trainerId, trainers]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !traineeId || !trainerId) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setNotice("");
    const supabase = createClient() as any;
    const { error } = await supabase.rpc("start_training_record", {
      p_trainee_profile_id: traineeId,
      p_trainer_profile_id: trainerId,
      p_program_type: program,
      p_phase: String(form.get("phase") ?? "Orientation").trim(),
      p_notes: String(form.get("notes") ?? "").trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setNotice(error.message ?? "Training could not be started.");
      return;
    }
    setOpen(false);
    setNotice(`${program} training started.`);
    router.refresh();
    window.setTimeout(() => setNotice(""), 4500);
  }

  return (
    <>
      <button className="portal-button portal-button--primary" onClick={() => setOpen(true)} type="button">Start Training</button>
      <PortalDialog
        open={open}
        onClose={() => { if (!submitting) setOpen(false); }}
        eyebrow="Training assignment"
        title="Start Training"
        description="Assign the member, program, trainer, and starting phase."
        dismissOnBackdrop={!submitting}
        footer={<><button className="portal-button portal-button--secondary" disabled={submitting} onClick={() => setOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={submitting || !trainerId || !traineeId} form="start-training-form" type="submit">{submitting ? "Starting…" : "Start Training"}</button></>}
      >
        <form className="portal-dialog-form" id="start-training-form" onSubmit={submit}>
          <div className="portal-form-grid portal-form-grid--two">
            <label>Program<select value={program} onChange={(event) => setProgram(event.target.value)}>{programs.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Trainee<select value={traineeId} onChange={(event) => setTraineeId(event.target.value)}>{personnel.map((person) => <option key={person.id} value={person.id}>{label(person)}</option>)}</select></label>
            <label>{program === "FTO" ? "Field Training Officer" : "Trainer"}<select value={trainerId} onChange={(event) => setTrainerId(event.target.value)}>{trainers.map((person) => <option key={person.id} value={person.id}>{label(person)}</option>)}</select></label>
            <label>Starting phase<input defaultValue="Orientation" list="training-start-phases" name="phase" required /></label>
          </div>
          <datalist id="training-start-phases">{phases.map((item) => <option key={item} value={item} />)}</datalist>
          <label>Assignment note <span>Optional</span><textarea name="notes" rows={3} /></label>
          {program === "FTO" && !trainers.length ? <div className="portal-form-protection"><strong>No eligible FTO</strong><span>Issue a current Field Training Officer certification before assigning FTO training.</span></div> : null}
        </form>
      </PortalDialog>
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
