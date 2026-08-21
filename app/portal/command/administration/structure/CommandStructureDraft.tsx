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

function isDraftState(value: unknown): value is DraftState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DraftState>;
  return candidate.version === 1 && Array.isArray(candidate.units) && Array.isArray(candidate.assignments) && Array.isArray(candidate.authorities);
}

export function CommandStructureDraft({ personnel }: { personnel: PersonnelOption[] }) {
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"units" | "assignments" | "authority">("units");
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importValue, setImportValue] = useState("");

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
        const parsed = JSON.parse(raw) as unknown;
        if (isDraftState(parsed)) setDraft(parsed);
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

  const warnings = useMemo(() => {
    const issues: string[] = [];
    const primaryCounts = new Map<string, number>();
    for (const assignment of draft.assignments) {
      if (assignment.type !== "Primary") continue;
      primaryCounts.set(assignment.personnelId, (primaryCounts.get(assignment.personnelId) ?? 0) + 1);
    }
    for (const [personnelId, count] of primaryCounts) {
      if (count > 1) issues.push(`${personnelById.get(personnelId)?.display_name ?? personnelId} has ${count} primary assignments.`);
    }
    for (const authority of draft.authorities) {
      if (authority.targetType === "Person" && authority.subjectPersonnelId === authority.supervisorPersonnelId) {
        issues.push(`${personnelById.get(authority.supervisorPersonnelId)?.display_name ?? authority.supervisorPersonnelId} has authority assigned over themself.`);
      }
    }
    return issues;
  }, [draft.assignments, draft.authorities, personnelById]);

  function addUnit() {
    const name = unitName.trim();
    if (!name) return;
    const duplicate = draft.units.some((unit) => unit.parentId === (unitParent || ROOT_ID) && unit.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setNotice("A unit with that name already exists under the selected parent.");
      return;
    }
    setDraft((current) => ({
      ...current,
      units: [...current.units, { id: newId("unit"), name, type: unitType, parentId: unitParent || ROOT_ID }],
    }));
    setUnitName("");
    setNotice(null);
  }

  function addAssignment() {
    if (!assignmentPerson || !assignmentUnit) return;
    const duplicate = draft.assignments.some(
      (row) => row.personnelId === assignmentPerson && row.unitId === assignmentUnit && row.type === assignmentType,
    );
    if (duplicate) {
      setNotice("That exact assignment already exists.");
      return;
    }
    if (assignmentType === "Primary" && draft.assignments.some((row) => row.personnelId === assignmentPerson && row.type === "Primary")) {
      setNotice("This member already has a primary assignment. Use Secondary, Special, Temporary, or Training unless the existing primary assignment is removed first.");
      return;
    }
    setDraft((current) => ({
      ...current,
      assignments: [...current.assignments, { id: newId("assignment"), personnelId: assignmentPerson, unitId: assignmentUnit, type: assignmentType }],
    }));
    setNotice(null);
  }

  function addAuthority() {
    if (!authoritySupervisor) return;
    if (authorityTargetType === "Unit" && !authorityUnit) return;
    if (authorityTargetType === "Person" && !authoritySubject) return;
    if (authorityTargetType === "Person" && authoritySupervisor === authoritySubject) {
      setNotice("A member cannot be assigned supervisory authority over themself.");
      return;
    }
    const duplicate = draft.authorities.some((row) =>
      row.supervisorPersonnelId === authoritySupervisor &&
      row.targetType === authorityTargetType &&
      row.unitId === (authorityTargetType === "Unit" ? authorityUnit : null) &&
      row.subjectPersonnelId === (authorityTargetType === "Person" ? authoritySubject : null) &&
      row.type === authorityType,
    );
    if (duplicate) {
      setNotice("That exact supervisory authority already exists.");
      return;
    }
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
    setNotice(null);
  }

  function removeUnit(id: string) {
    if (id === ROOT_ID) return;
    const childUnits = draft.units.filter((unit) => unit.parentId === id);
    if (childUnits.length) {
      setNotice("Remove or move the child units first. This prevents an accidental orphaned structure.");
      return;
    }
    setDraft((current) => ({
      ...current,
      units: current.units.filter((unit) => unit.id !== id),
      assignments: current.assignments.filter((row) => row.unitId !== id),
      authorities: current.authorities.filter((row) => row.unitId !== id),
    }));
    setNotice(null);
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft));
      setNotice("Draft copied. Paste it into Import Draft on the other browser.");
    } catch {
      setImportValue(JSON.stringify(draft));
      setImportOpen(true);
      setNotice("Clipboard access was blocked. Copy the draft text below instead.");
    }
  }

  function importDraft() {
    try {
      const parsed = JSON.parse(importValue) as unknown;
      if (!isDraftState(parsed) || !parsed.units.some((unit) => unit.id === ROOT_ID)) {
        setNotice("That is not a valid LSCSO Command Structure draft.");
        return;
      }
      setDraft(parsed);
      setImportValue("");
      setImportOpen(false);
      setNotice("Draft imported into this browser. Production was not changed.");
    } catch {
      setNotice("The draft text could not be read. Make sure the full copied draft was pasted.");
    }
  }

  function resetDraft() {
    if (!window.confirm("Clear this browser-only Command Structure draft? This does not affect the database.")) return;
    setDraft(initialDraft);
    setNotice("Browser draft cleared. Production was not changed.");
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

      <div className="command-structure-transfer-row">
        <button className="portal-button portal-button--secondary" onClick={copyDraft} type="button">Copy Draft</button>
        <button className="portal-button portal-button--secondary" onClick={() => setImportOpen((value) => !value)} type="button">Import Draft</button>
        <span>Use these to move the same draft between authorized browsers.</span>
      </div>

      {importOpen ? (
        <div className="command-structure-import">
          <label><span>Draft data</span><textarea value={importValue} onChange={(event) => setImportValue(event.target.value)} placeholder="Paste copied LSCSO structure draft" /></label>
          <div className="command-v2-action-row"><button className="portal-button portal-button--primary" onClick={importDraft} type="button">Import</button></div>
        </div>
      ) : null}

      {notice ? <div className="command-structure-editor-notice" role="status">{notice}</div> : null}
      {warnings.length ? (
        <div className="command-structure-editor-warnings">
          <strong>Draft checks</strong>
          {warnings.map((warning) => <span key={warning}>{warning}</span>)}
        </div>
      ) : null}

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
