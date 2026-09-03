"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PortalDialog } from "./PortalDialog";

type Unit = { id: string; name: string; unitType: string };
type Assignment = { id: string; unitId: string; unitName: string; unitType: string; assignmentType: string; startsAt: string; notes: string | null };

const assignmentTypes = ["Primary", "Secondary", "Special", "Temporary", "Training"] as const;

export function PersonnelAssignmentManager({ profileId, displayName, units, assignments, canManage }: { profileId: string; displayName: string; units: Unit[]; assignments: Assignment[]; canManage: boolean }) {
  const router = useRouter();
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [assignmentType, setAssignmentType] = useState<(typeof assignmentTypes)[number]>("Primary");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [replacePrimaryOpen, setReplacePrimaryOpen] = useState(false);
  const [endTarget, setEndTarget] = useState<Assignment | null>(null);
  const [endReason, setEndReason] = useState("");
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  async function performAssignment() {
    if (!unitId || pending) return;
    const unit = unitsById.get(unitId);
    setPending(true);
    setNotice("");
    const { error } = await (createClient() as any).rpc("v2_assign_personnel_to_unit", {
      p_profile_id: profileId,
      p_unit_id: unitId,
      p_assignment_type: assignmentType,
      p_notes: notes.trim() || null,
    });
    setPending(false);
    if (error) return setNotice(error.message);
    setReplacePrimaryOpen(false);
    setNotes("");
    setNotice(`${displayName} assigned to ${unit?.name ?? "the selected unit"}.`);
    router.refresh();
  }

  function assign() {
    if (!unitId) return setNotice("Choose an organizational unit first.");
    const replacingPrimary = assignmentType === "Primary" && assignments.some((row) => row.assignmentType === "Primary");
    if (replacingPrimary) {
      setReplacePrimaryOpen(true);
      return;
    }
    void performAssignment();
  }

  function requestEndAssignment(assignment: Assignment) {
    setEndReason("");
    setEndTarget(assignment);
  }

  async function confirmEndAssignment() {
    if (!endTarget || pending) return;
    const target = endTarget;
    setPending(true);
    setNotice("");
    const { error } = await (createClient() as any).rpc("v2_end_personnel_assignment", {
      p_assignment_id: target.id,
      p_reason: endReason.trim() || null,
    });
    setPending(false);
    if (error) return setNotice(error.message);
    setEndTarget(null);
    setEndReason("");
    setNotice("Assignment ended. Its history remains in the service record.");
    router.refresh();
  }

  const replacementUnit = unitsById.get(unitId);

  return (
    <>
      <section className="portal-panel personnel-assignment-manager" id="assignments">
        <div className="portal-panel-heading">
          <div><p>Organizational placement</p><h2>Divisions & assignments</h2></div>
          <span>{assignments.length} active</span>
        </div>
        <p className="personnel-section-intro">A primary assignment is the member&apos;s home division. Secondary, special, temporary, and training assignments can be added without replacing it.</p>

        {canManage ? (
          <div className="personnel-assignment-form" aria-label="Add assignment">
            <label><span>1. Choose unit</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.unitType}</option>)}</select></label>
            <label><span>2. Assignment type</span><select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as (typeof assignmentTypes)[number])}>{assignmentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label><span>3. Note (optional)</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Reason or assignment context" /></label>
            <button className="portal-button portal-button--primary" disabled={pending || !units.length} onClick={assign} type="button">Add assignment</button>
          </div>
        ) : <div className="command-v2-inline-state"><strong>View only.</strong><span>Command access is required to change organizational assignments.</span></div>}

        {notice ? <div className="personnel-inline-notice" role="status">{notice}</div> : null}
        <div className="personnel-assignment-list">
          {assignments.length ? assignments.map((assignment) => (
            <article key={assignment.id}>
              <div><span>{assignment.assignmentType}</span><strong>{assignment.unitName}</strong><small>{assignment.unitType} · Since {new Date(assignment.startsAt).toLocaleDateString()}{assignment.notes ? ` · ${assignment.notes}` : ""}</small></div>
              {canManage ? <button disabled={pending} onClick={() => requestEndAssignment(assignment)} type="button">End assignment</button> : null}
            </article>
          )) : <div className="portal-empty-state"><strong>No active assignments.</strong><span>Add a primary division to establish this member&apos;s organizational home.</span></div>}
        </div>
      </section>

      <PortalDialog
        open={replacePrimaryOpen}
        onClose={() => { if (!pending) setReplacePrimaryOpen(false); }}
        eyebrow="Primary assignment"
        title="Replace current primary assignment?"
        description="A member can have only one active Primary assignment. The existing Primary assignment will be ended and preserved in history."
        dismissOnBackdrop={false}
        footer={<><button className="portal-button portal-button--secondary" disabled={pending} onClick={() => setReplacePrimaryOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={pending} onClick={() => void performAssignment()} type="button">{pending ? "Updating…" : "Replace primary assignment"}</button></>}
      >
        <div className="portal-form-protection"><strong>{displayName}</strong><span>New primary assignment: {replacementUnit?.name ?? "Selected unit"}. Existing assignment history remains available.</span></div>
      </PortalDialog>

      <PortalDialog
        open={Boolean(endTarget)}
        onClose={() => { if (!pending) { setEndTarget(null); setEndReason(""); } }}
        eyebrow="Assignment history"
        title="End assignment?"
        description="The assignment will stop being active, but its history will remain in the member's service record."
        dismissOnBackdrop={false}
        footer={<><button className="portal-button portal-button--secondary" disabled={pending} onClick={() => { setEndTarget(null); setEndReason(""); }} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={pending} onClick={() => void confirmEndAssignment()} type="button">{pending ? "Ending…" : "End assignment"}</button></>}
      >
        <div className="portal-form-protection"><strong>{endTarget ? `${endTarget.assignmentType} · ${endTarget.unitName}` : "Assignment"}</strong><span>{displayName}</span></div>
        <label className="portal-dialog-field">Reason <span>Optional</span><textarea value={endReason} onChange={(event) => setEndReason(event.target.value)} rows={3} placeholder="Administrative reason or context..." /></label>
      </PortalDialog>
    </>
  );
}
