"use client";

import { useEffect, useMemo, useState } from "react";

type PersonnelOption = {
  personnel_id: string;
  display_name: string;
  rank: string;
  call_sign: string | null;
  division: string | null;
};

type UnitType = "Bureau" | "Division" | "Unit" | "Team" | "Detail" | "Program" | "Shift";
type AssignmentType = "Primary" | "Secondary" | "Special" | "Temporary" | "Training";
type AuthorityType = "Primary" | "Unit" | "Command" | "Training" | "Temporary";

type DraftUnit = {
  id: string;
  name: string;
  type: UnitType;
  parentId: string | null;
};

type DraftAssignment = {
  id: string;
  personnelId: string;
  unitId: string;
  type: AssignmentType;
};

type DraftAuthority = {
  id: string;
  supervisorPersonnelId: string;
  targetType: "Unit" | "Person";
  unitId: string | null;
  subjectPersonnelId: string | null;
  type: AuthorityType;
};

type DraftState = {
  version: 1;
  units: DraftUnit[];
  assignments: DraftAssignment[];
  authorities: DraftAuthority[];
};

const STORAGE_KEY = "lscso.command-structure-draft:v1";
const ROOT_ID = "lscso-root";

const initialDraft: DraftState = {
  version: 1,
  units: [{ id: ROOT_ID, name: "LSCSO", type: "Bureau", parentId: null }],
  assignments: [],
  authorities: [],
};

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CommandStructureDraft({ personnel }: { personnel: PersonnelOption[] }) {
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"units" | "assignments" | "authority">("units");

  const [unitName, setUnitName] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("Division");
  const [unitParent, setUnitParent] = useState(ROOT_ID);

  const [assignmentPerson, setAssignmentPerson] = useState(personnel[0]?.personnel_id ?? "");
  const [assignmentUnit, setAssignmentUnit] = useState(ROOT_ID);
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("Primary");

  const [authoritySupervisor, setAuthoritySupervisor] = useState(personnel[0]?.personnel_id ?? "");
  const [authorityTargetType, setAuthorityTargetType] = useState<"Unit" | "Person">("Unit");
  const [authorityUnit, setAuthorityUnit] = useState(ROOT_ID);
  const [authoritySubject, setAuthoritySubject] = useState(personnel[0]?.personnel_id ?? "");
  const [authorityType, setAuthorityType] = useState<AuthorityType>("Unit");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftState;
        if (parsed?.version === 1 && Array.isArray(parsed.units) && Array.isArray(parsed.assignments) && Array.isArray(parsed.authorities)) {
          setDraft(parsed);
        }
      }
    } catch {
      setDraft(initialDraft);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, loaded]);

  const personnelById = useMemo(() => new Map(personnel.map((person) => [person.personnel_id, person])), [personnel]);
  const unitById = useMemo(() => new Map(draft.units.map((unit) => [unit.id, unit])), [draft.units]);

  const sortedUnits = useMemo(() => {
    const depth = (unit: DraftUnit) => {
      let value = 0;
      let cursor = unit;
      const seen = new Set<string>();
      while (cursor.parentId && unitById.has(cursor.parentId) && !seen.has(cursor.parentId)) {
        seen.add(cursor.parentId);
        value += 1;
        cursor = unitById.get(cursor.parentId)!;
      }
      return value;
    };
    return [...draft.units].sort((a, b) => depth(a) - depth(b) || a.name.localeCompare(b.name));
  }, [draft.units, unitById]);

  function addUnit() {
    const name = unitName.trim();
    if (!name) return;
    setDraft((current) => ({
      ...current,
      units: [...current.units, { id: newId("unit"), name, type: unitType, parentId: unitParent || ROOT_ID }],
    }));
    setUnitName("");
  }

  function addAssignment() {
    if (!assignmentPerson || !assignmentUnit) return;
    const duplicate = draft.assignments.some(
      (row) => row.personnelId === assignmentPerson && row.unitId === assignmentUnit && row.type === assignmentType,
    );
    if (duplicate) return;
    setDraft((current) => ({
      ...current,
      assignments: [...current.assignments, { id: newId("assignment"), personnelId: assignmentPerson, unitId: assignmentUnit, type: assignmentType }],
    }));
  }

  function addAuthority() {
    if (!authoritySupervisor) return;
    if (authorityTargetType === "Unit" && !authorityUnit) return;
    if (authorityTargetType === "Person" && !authoritySubject) return;
    setDraft((current) => ({
      ...current,
      authorities: [
        ...current.authorities,
        {
          id: newId("authority"),
          supervisorPersonnelId: authoritySupervisor,
          targetType: authorityTargetType,
          unitId: authorityTargetType === "Unit" ? authorityUnit : null,
          subjectPersonnelId: authorityTargetType === "Person" ? authoritySubject : null,
          type: authorityType,
        },
      ],
    }));
  }

  function removeUnit(id: string) {
    if (id === ROOT_ID) return;
    setDraft((current) => ({
      ...current,
      units: current.units.filter((unit) => unit.id !== id),
      assignments: current.assignments.filter((row) => row.unitId !== id),
      authorities: current.authorities.filter((row) => row.unitId !== id),
    }));
  }

  function resetDraft() {
    if (!window.confirm("Clear this browser-only Command Structure draft? This does not affect the database.")) return;
    setDraft(initialDraft);
  }

  return (
    <section className="portal-panel command-structure-editor">
      <div className="portal-panel-heading">
        <div><p>Draft builder</p><h2>Model the LSCSO structure</h2></div>
        <span>{loaded ? "Browser draft" : "Loading"}</span>
      </div>

      <div className="command-structure-draft-note">
        <strong>Preview only.</strong>
        <span>Changes here are saved in this browser and do not write to Supabase.</span>
      </div>

      <div className="command-structure-editor-tabs" role="tablist" aria-label="Command Structure draft sections">
        <button className={activeTab === "units" ? "is-active" : ""} onClick={() => setActiveTab("units")} type="button">Units <span>{draft.units.length - 1}</span></button>
        <button className={activeTab === "assignments" ? "is-active" : ""} onClick={() => setActiveTab("assignments")} type="button">Assignments <span>{draft.assignments.length}</span></button>
        <button className={activeTab === "authority" ? "is-active" : ""} onClick={() => setActiveTab("authority")} type="button">Supervisory Authority <span>{draft.authorities.length}</span></button>
      </div>

      {activeTab === "units" ? (
        <div className="command-structure-editor-body">
          <div className="command-structure-form-row">
            <label><span>Name</span><input value={unitName} onChange={(event) => setUnitName(event.target.value)} placeholder="Patrol Division" /></label>
            <label><span>Type</span><select value={unitType} onChange={(event) => setUnitType(event.target.value as UnitType)}>{(["Bureau","Division","Unit","Team","Detail","Program","Shift"] as UnitType[]).map((type) => <option key={type}>{type}</option>)}</select></label>
            <label><span>Parent</span><select value={unitParent} onChange={(event) => setUnitParent(event.target.value)}>{sortedUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.type}</option>)}</select></label>
            <button className="portal-button portal-button--primary" onClick={addUnit} type="button">Add Unit</button>
          </div>

          <div className="command-structure-draft-list">
            {sortedUnits.map((unit) => {
              const parent = unit.parentId ? unitById.get(unit.parentId) : null;
              return (
                <div key={unit.id}>
                  <div><strong>{unit.name}</strong><span>{unit.type}{parent ? ` · under ${parent.name}` : " · root"}</span></div>
                  {unit.id !== ROOT_ID ? <button onClick={() => removeUnit(unit.id)} type="button">Remove</button> : <small>Department root</small>}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTab === "assignments" ? (
        <div className="command-structure-editor-body">
          <div className="command-structure-form-row">
            <label><span>Personnel</span><select value={assignmentPerson} onChange={(event) => setAssignmentPerson(event.target.value)}>{personnel.map((person) => <option key={person.personnel_id} value={person.personnel_id}>{person.display_name} · {person.rank}</option>)}</select></label>
            <label><span>Unit</span><select value={assignmentUnit} onChange={(event) => setAssignmentUnit(event.target.value)}>{sortedUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.type}</option>)}</select></label>
            <label><span>Assignment</span><select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as AssignmentType)}>{(["Primary","Secondary","Special","Temporary","Training"] as AssignmentType[]).map((type) => <option key={type}>{type}</option>)}</select></label>
            <button className="portal-button portal-button--primary" onClick={addAssignment} type="button">Add Assignment</button>
          </div>

          <div className="command-structure-draft-list">
            {draft.assignments.length ? draft.assignments.map((row) => {
              const person = personnelById.get(row.personnelId);
              const unit = unitById.get(row.unitId);
              return <div key={row.id}><div><strong>{person?.display_name ?? row.personnelId}</strong><span>{row.type} · {unit?.name ?? "Unknown unit"}</span></div><button onClick={() => setDraft((current) => ({ ...current, assignments: current.assignments.filter((item) => item.id !== row.id) }))} type="button">Remove</button></div>;
            }) : <div className="command-structure-empty">No draft assignments yet.</div>}
          </div>
        </div>
      ) : null}

      {activeTab === "authority" ? (
        <div className="command-structure-editor-body">
          <div className="command-structure-form-row command-structure-authority-form">
            <label><span>Supervisor</span><select value={authoritySupervisor} onChange={(event) => setAuthoritySupervisor(event.target.value)}>{personnel.map((person) => <option key={person.personnel_id} value={person.personnel_id}>{person.display_name} · {person.rank}</option>)}</select></label>
            <label><span>Authority</span><select value={authorityType} onChange={(event) => setAuthorityType(event.target.value as AuthorityType)}>{(["Primary","Unit","Command","Training","Temporary"] as AuthorityType[]).map((type) => <option key={type}>{type}</option>)}</select></label>
            <label><span>Scope target</span><select value={authorityTargetType} onChange={(event) => setAuthorityTargetType(event.target.value as "Unit" | "Person")}><option>Unit</option><option>Person</option></select></label>
            {authorityTargetType === "Unit" ? <label><span>Unit</span><select value={authorityUnit} onChange={(event) => setAuthorityUnit(event.target.value)}>{sortedUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.type}</option>)}</select></label> : <label><span>Person</span><select value={authoritySubject} onChange={(event) => setAuthoritySubject(event.target.value)}>{personnel.map((person) => <option key={person.personnel_id} value={person.personnel_id}>{person.display_name} · {person.rank}</option>)}</select></label>}
            <button className="portal-button portal-button--primary" onClick={addAuthority} type="button">Add Authority</button>
          </div>

          <div className="command-structure-draft-list">
            {draft.authorities.length ? draft.authorities.map((row) => {
              const supervisor = personnelById.get(row.supervisorPersonnelId);
              const target = row.targetType === "Unit" ? unitById.get(row.unitId ?? "")?.name : personnelById.get(row.subjectPersonnelId ?? "")?.display_name;
              return <div key={row.id}><div><strong>{supervisor?.display_name ?? row.supervisorPersonnelId}</strong><span>{row.type} authority · {row.targetType}: {target ?? "Unknown"}</span></div><button onClick={() => setDraft((current) => ({ ...current, authorities: current.authorities.filter((item) => item.id !== row.id) }))} type="button">Remove</button></div>;
            }) : <div className="command-structure-empty">No draft supervisory authority yet.</div>}
          </div>
        </div>
      ) : null}

      <div className="command-structure-editor-footer">
        <span>{draft.units.length - 1} units · {draft.assignments.length} assignments · {draft.authorities.length} authority records</span>
        <button onClick={resetDraft} type="button">Clear draft</button>
      </div>
    </section>
  );
}
