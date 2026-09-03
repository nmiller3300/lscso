"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PortalDialog } from "../../../_components/PortalDialog";

type UnitType = "Bureau" | "Division" | "Unit" | "Team" | "Detail" | "Program" | "Shift";
type AssignmentType = "Primary" | "Secondary" | "Special" | "Temporary" | "Training";
type AuthorityType = "Primary" | "Unit" | "Command" | "Training" | "Temporary";
type Personnel = { id: string; personnel_id: string; display_name: string; rank: string; call_sign: string | null };
type Unit = { id: string; name: string; unit_type: UnitType; parent_unit_id: string | null };
type Assignment = { id: string; profile_id: string; organizational_unit_id: string; assignment_type: AssignmentType; starts_at: string; notes: string | null };
type Authority = { id: string; supervisor_profile_id: string; authority_type: string; organizational_unit_id: string | null; subject_profile_id: string | null; starts_at: string; reason: string | null };
type Props = { personnel: Personnel[]; units: Unit[]; assignments: Assignment[]; authorities: Authority[] };
type ConfirmAction = { kind: "retire-unit"; unit: Unit } | { kind: "replace-primary" } | { kind: "end-assignment"; row: Assignment } | { kind: "end-authority"; row: Authority };

const unitTypes: UnitType[] = ["Bureau", "Division", "Unit", "Team", "Detail", "Program", "Shift"];
const assignmentTypes: AssignmentType[] = ["Primary", "Secondary", "Special", "Temporary", "Training"];
const authorityTypes: AuthorityType[] = ["Primary", "Unit", "Command", "Training", "Temporary"];

export function CommandStructureManager({ personnel, units, assignments, authorities }: Props) {
  const router = useRouter();
  const supabase = createClient() as any;
  const [tab, setTab] = useState<"units" | "assignments" | "authority">("units");
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionReason, setActionReason] = useState("");

  const root = units.find((unit) => unit.parent_unit_id === null) ?? units[0];
  const operationalUnits = units.filter((unit) => unit.id !== root?.id);
  const personnelById = useMemo(() => new Map(personnel.map((person) => [person.id, person])), [personnel]);
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  const [unitName, setUnitName] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("Division");
  const [unitParent, setUnitParent] = useState(root?.id ?? "");
  const [assignmentPerson, setAssignmentPerson] = useState(personnel[0]?.id ?? "");
  const [assignmentUnit, setAssignmentUnit] = useState(operationalUnits[0]?.id ?? "");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("Primary");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [authoritySupervisor, setAuthoritySupervisor] = useState(personnel[0]?.id ?? "");
  const [authorityType, setAuthorityType] = useState<AuthorityType>("Unit");
  const [authorityTargetType, setAuthorityTargetType] = useState<"Unit" | "Person">("Unit");
  const [authorityUnit, setAuthorityUnit] = useState(operationalUnits[0]?.id ?? "");
  const [authoritySubject, setAuthoritySubject] = useState(personnel[0]?.id ?? "");
  const [authorityReason, setAuthorityReason] = useState("");

  async function run(operation: () => Promise<{ error?: { message?: string } | null }>, success: string) {
    setWorking(true);
    setNotice(null);
    try {
      const result = await operation();
      if (result?.error) throw new Error(result.error.message || "The structural change could not be completed.");
      setNotice(success);
      router.refresh();
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The structural change could not be completed.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function createUnit() {
    const name = unitName.trim();
    if (!name || !unitParent) return setNotice("Unit name and parent are required.");
    const ok = await run(() => supabase.rpc("v2_create_organizational_unit", { p_name: name, p_unit_type: unitType, p_parent_unit_id: unitParent }), `${name} created.`);
    if (ok) setUnitName("");
  }

  function requestRetireUnit(unit: Unit) {
    if (unit.id === root?.id) return;
    setActionReason("");
    setConfirmAction({ kind: "retire-unit", unit });
  }

  async function performAssignment() {
    if (!assignmentPerson || !assignmentUnit) { setNotice("Personnel and unit are required."); return false; }
    const person = personnelById.get(assignmentPerson);
    const unit = unitsById.get(assignmentUnit);
    const ok = await run(() => supabase.rpc("v2_assign_personnel_to_unit", { p_profile_id: assignmentPerson, p_unit_id: assignmentUnit, p_assignment_type: assignmentType, p_notes: assignmentNotes.trim() || null }), `${person?.display_name ?? "Personnel"} assigned to ${unit?.name ?? "unit"}.`);
    if (ok) setAssignmentNotes("");
    return ok;
  }

  function assignPersonnel() {
    if (!assignmentPerson || !assignmentUnit) return setNotice("Personnel and unit are required.");
    const replacingPrimary = assignmentType === "Primary" && assignments.some((row) => row.profile_id === assignmentPerson && row.assignment_type === "Primary");
    if (replacingPrimary) {
      setActionReason("");
      setConfirmAction({ kind: "replace-primary" });
      return;
    }
    void performAssignment();
  }

  function requestEndAssignment(row: Assignment) {
    setActionReason("");
    setConfirmAction({ kind: "end-assignment", row });
  }

  async function grantAuthority() {
    if (!authoritySupervisor) return setNotice("Supervisor is required.");
    if (authorityTargetType === "Unit" && !authorityUnit) return setNotice("Unit is required.");
    if (authorityTargetType === "Person" && !authoritySubject) return setNotice("Personnel target is required.");
    if (authorityTargetType === "Person" && authoritySupervisor === authoritySubject) return setNotice("A member cannot supervise themself.");
    const supervisor = personnelById.get(authoritySupervisor);
    const ok = await run(() => supabase.rpc("v2_grant_supervisory_authority", { p_supervisor_profile_id: authoritySupervisor, p_authority_type: authorityType, p_unit_id: authorityTargetType === "Unit" ? authorityUnit : null, p_subject_profile_id: authorityTargetType === "Person" ? authoritySubject : null, p_reason: authorityReason.trim() || null }), `Authority granted to ${supervisor?.display_name ?? "supervisor"}.`);
    if (ok) setAuthorityReason("");
  }

  function requestEndAuthority(row: Authority) {
    setActionReason("");
    setConfirmAction({ kind: "end-authority", row });
  }

  async function confirmStructuralAction() {
    if (!confirmAction || working) return;
    let ok = false;
    if (confirmAction.kind === "retire-unit") {
      ok = await run(() => supabase.rpc("v2_retire_organizational_unit", { p_unit_id: confirmAction.unit.id, p_reason: actionReason.trim() || null }), `${confirmAction.unit.name} retired.`);
    } else if (confirmAction.kind === "replace-primary") {
      ok = await performAssignment();
    } else if (confirmAction.kind === "end-assignment") {
      ok = await run(() => supabase.rpc("v2_end_personnel_assignment", { p_assignment_id: confirmAction.row.id, p_reason: actionReason.trim() || null }), "Assignment ended and retained in history.");
    } else {
      ok = await run(() => supabase.rpc("v2_end_supervisory_authority", { p_authority_id: confirmAction.row.id, p_reason: actionReason.trim() || null }), "Supervisory authority ended and retained in history.");
    }
    if (ok) {
      setConfirmAction(null);
      setActionReason("");
    }
  }

  const confirmMeta = (() => {
    if (!confirmAction) return { eyebrow: "Executive control", title: "Confirm structural change", description: "Review this change before it is written to the department structure.", detail: "", needsReason: false, action: "Confirm change" };
    if (confirmAction.kind === "retire-unit") return { eyebrow: "Organizational structure", title: `Retire ${confirmAction.unit.name}?`, description: "The unit will become inactive. Existing history remains, and active children, assignments, or authority must be resolved first.", detail: `${confirmAction.unit.unit_type} · Live department structure`, needsReason: true, action: "Retire unit" };
    if (confirmAction.kind === "replace-primary") {
      const person = personnelById.get(assignmentPerson);
      const unit = unitsById.get(assignmentUnit);
      return { eyebrow: "Primary assignment", title: "Replace current primary assignment?", description: "The existing Primary assignment will end and remain in history before the selected unit becomes the member's new home assignment.", detail: `${person?.display_name ?? "Personnel"} → ${unit?.name ?? "Selected unit"}`, needsReason: false, action: "Replace primary assignment" };
    }
    if (confirmAction.kind === "end-assignment") {
      const person = personnelById.get(confirmAction.row.profile_id);
      const unit = unitsById.get(confirmAction.row.organizational_unit_id);
      return { eyebrow: "Assignment history", title: "End active assignment?", description: "This removes the assignment from active structure while preserving its full service history.", detail: `${person?.display_name ?? "Personnel"} · ${confirmAction.row.assignment_type} · ${unit?.name ?? "Unit"}`, needsReason: true, action: "End assignment" };
    }
    const supervisor = personnelById.get(confirmAction.row.supervisor_profile_id);
    return { eyebrow: "Supervisory authority", title: "End supervisory authority?", description: "The authority grant will stop being active and will remain available in the department audit/history record.", detail: `${supervisor?.display_name ?? "Supervisor"} · ${confirmAction.row.authority_type} authority`, needsReason: true, action: "End authority" };
  })();

  return (
    <>
      <section className="portal-panel command-structure-editor">
        <div className="portal-panel-heading"><div><p>Live structure</p><h2>Manage LSCSO organization</h2></div><span>Database-backed</span></div>
        <div className="command-structure-draft-note"><strong>Executive-controlled.</strong><span>Changes are written through audited LSCSO authority functions. Ending an assignment or authority preserves its history.</span></div>
        {notice ? <div className="command-structure-editor-notice" role="status">{notice}</div> : null}

        <div className="command-structure-editor-tabs" role="tablist" aria-label="Command Structure sections">
          <button className={tab === "units" ? "is-active" : ""} onClick={() => setTab("units")} type="button">Units <span>{operationalUnits.length}</span></button>
          <button className={tab === "assignments" ? "is-active" : ""} onClick={() => setTab("assignments")} type="button">Assignments <span>{assignments.length}</span></button>
          <button className={tab === "authority" ? "is-active" : ""} onClick={() => setTab("authority")} type="button">Supervisory Authority <span>{authorities.length}</span></button>
        </div>

        {tab === "units" ? <div className="command-structure-editor-body"><div className="command-structure-form-row"><label><span>Name</span><input value={unitName} onChange={(event) => setUnitName(event.target.value)} placeholder="Investigations Division" /></label><label><span>Type</span><select value={unitType} onChange={(event) => setUnitType(event.target.value as UnitType)}>{unitTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label><span>Parent</span><select value={unitParent} onChange={(event) => setUnitParent(event.target.value)}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.unit_type}</option>)}</select></label><button className="portal-button portal-button--primary" disabled={working} onClick={createUnit} type="button">Create Unit</button></div><div className="command-structure-draft-list">{units.map((unit) => { const parent = unit.parent_unit_id ? unitsById.get(unit.parent_unit_id) : null; return <div key={unit.id}><div><strong>{unit.name}</strong><span>{unit.unit_type}{parent ? ` · under ${parent.name}` : " · department root"}</span></div>{unit.id === root?.id ? <small>Department root</small> : <button disabled={working} onClick={() => requestRetireUnit(unit)} type="button">Retire</button>}</div>; })}</div></div> : null}

        {tab === "assignments" ? <div className="command-structure-editor-body"><div className="command-structure-form-row"><label><span>Personnel</span><select value={assignmentPerson} onChange={(event) => setAssignmentPerson(event.target.value)}>{personnel.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {person.rank}</option>)}</select></label><label><span>Unit</span><select value={assignmentUnit} onChange={(event) => setAssignmentUnit(event.target.value)}>{operationalUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.unit_type}</option>)}</select></label><label><span>Assignment</span><select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as AssignmentType)}>{assignmentTypes.map((type) => <option key={type}>{type}</option>)}</select></label><button className="portal-button portal-button--primary" disabled={working} onClick={assignPersonnel} type="button">Assign</button></div><label className="command-v2-search-field"><span>Assignment note</span><input value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} placeholder="Optional context" /></label><div className="command-structure-draft-list">{assignments.length ? assignments.map((row) => { const person = personnelById.get(row.profile_id); const unit = unitsById.get(row.organizational_unit_id); return <div key={row.id}><div><strong>{person?.display_name ?? "Unknown personnel"}</strong><span>{row.assignment_type} · {unit?.name ?? "Unknown unit"} · since {new Date(row.starts_at).toLocaleDateString()}</span>{row.notes ? <small>{row.notes}</small> : null}</div><button disabled={working} onClick={() => requestEndAssignment(row)} type="button">End</button></div>; }) : <div className="command-structure-empty">No active structured assignments.</div>}</div></div> : null}

        {tab === "authority" ? <div className="command-structure-editor-body"><div className="command-structure-form-row command-structure-authority-form"><label><span>Supervisor</span><select value={authoritySupervisor} onChange={(event) => setAuthoritySupervisor(event.target.value)}>{personnel.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {person.rank}</option>)}</select></label><label><span>Authority</span><select value={authorityType} onChange={(event) => setAuthorityType(event.target.value as AuthorityType)}>{authorityTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label><span>Target</span><select value={authorityTargetType} onChange={(event) => setAuthorityTargetType(event.target.value as "Unit" | "Person")}><option>Unit</option><option>Person</option></select></label>{authorityTargetType === "Unit" ? <label><span>Unit</span><select value={authorityUnit} onChange={(event) => setAuthorityUnit(event.target.value)}>{operationalUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.unit_type}</option>)}</select></label> : <label><span>Person</span><select value={authoritySubject} onChange={(event) => setAuthoritySubject(event.target.value)}>{personnel.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {person.rank}</option>)}</select></label>}<button className="portal-button portal-button--primary" disabled={working} onClick={grantAuthority} type="button">Grant</button></div><label className="command-v2-search-field"><span>Authority reason</span><input value={authorityReason} onChange={(event) => setAuthorityReason(event.target.value)} placeholder="Optional context" /></label><div className="command-structure-draft-list">{authorities.length ? authorities.map((row) => { const supervisor = personnelById.get(row.supervisor_profile_id); const target = row.organizational_unit_id ? unitsById.get(row.organizational_unit_id)?.name : personnelById.get(row.subject_profile_id ?? "")?.display_name; return <div key={row.id}><div><strong>{supervisor?.display_name ?? "Unknown supervisor"}</strong><span>{row.authority_type} authority · {row.organizational_unit_id ? "Unit" : "Person"}: {target ?? "Unknown"} · since {new Date(row.starts_at).toLocaleDateString()}</span>{row.reason ? <small>{row.reason}</small> : null}</div><button disabled={working} onClick={() => requestEndAuthority(row)} type="button">End</button></div>; }) : <div className="command-structure-empty">No active structured supervisory authority.</div>}</div></div> : null}
      </section>

      <PortalDialog open={Boolean(confirmAction)} onClose={() => { if (!working) { setConfirmAction(null); setActionReason(""); } }} eyebrow={confirmMeta.eyebrow} title={confirmMeta.title} description={confirmMeta.description} dismissOnBackdrop={false} footer={<><button className="portal-button portal-button--secondary" disabled={working} onClick={() => { setConfirmAction(null); setActionReason(""); }} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={working} onClick={() => void confirmStructuralAction()} type="button">{working ? "Updating…" : confirmMeta.action}</button></>}>
        <div className="portal-form-protection"><strong>{confirmMeta.detail || "Executive structural action"}</strong><span>Changes are attributed and retained through the LSCSO audit model.</span></div>
        {confirmMeta.needsReason ? <label className="portal-dialog-field">Reason <span>Optional</span><textarea value={actionReason} onChange={(event) => setActionReason(event.target.value)} rows={3} placeholder="Administrative reason or context..." /></label> : null}
      </PortalDialog>
    </>
  );
}
