"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Unit = { id: string; name: string; unitType: string };
type Assignment = { id: string; unitId: string; unitName: string; unitType: string; assignmentType: string; startsAt: string; notes: string | null };

const assignmentTypes = ["Primary", "Secondary", "Special", "Temporary", "Training"] as const;

export function PersonnelAssignmentManager({
  profileId,
  displayName,
  units,
  assignments,
  canManage,
}: {
  profileId: string;
  displayName: string;
  units: Unit[];
  assignments: Assignment[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [assignmentType, setAssignmentType] = useState<(typeof assignmentTypes)[number]>("Primary");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  async function assign() {
    if (!unitId) return setNotice("Choose an organizational unit first.");
    const unit = unitsById.get(unitId);
    const replacingPrimary = assignmentType === "Primary" && assignments.some((row) => row.assignmentType === "Primary");
    if (replacingPrimary && !window.confirm(`Replace ${displayName}'s current primary assignment with ${unit?.name ?? "this unit"}?`)) return;
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
    setNotes("");
    setNotice(`${displayName} assigned to ${unit?.name ?? "the selected unit"}.`);
    router.refresh();
  }

  async function endAssignment(assignment: Assignment) {
    if (!window.confirm(`End ${displayName}'s ${assignment.assignmentType.toLowerCase()} assignment to ${assignment.unitName}?`)) return;
    const reason = window.prompt("Reason for ending this assignment (optional)") ?? "";
    setPending(true);
    setNotice("");
    const { error } = await (createClient() as any).rpc("v2_end_personnel_assignment", {
      p_assignment_id: assignment.id,
      p_reason: reason.trim() || null,
    });
    setPending(false);
    if (error) return setNotice(error.message);
    setNotice("Assignment ended. Its history remains in the service record.");
    router.refresh();
  }

  return (
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
            {canManage ? <button disabled={pending} onClick={() => endAssignment(assignment)} type="button">End assignment</button> : null}
          </article>
        )) : <div className="portal-empty-state"><strong>No active assignments.</strong><span>Add a primary division to establish this member&apos;s organizational home.</span></div>}
      </div>
    </section>
  );
}
