"use client";

import { useMemo, useState } from "react";
import { PersonnelAssignmentManager } from "../../_components/PersonnelAssignmentManager";

export type DivisionPersonnel = {
  id: string;
  personnelId: string;
  displayName: string;
  rank: string;
  callSign: string | null;
  primaryAssignment: string;
};

export type DivisionUnit = { id: string; name: string; unitType: string };
export type DivisionAssignment = {
  id: string;
  profileId: string;
  unitId: string;
  unitName: string;
  unitType: string;
  assignmentType: string;
  startsAt: string;
  notes: string | null;
};

export function DivisionAssignmentWorkspace({
  personnel,
  units,
  assignments,
}: {
  personnel: DivisionPersonnel[];
  units: DivisionUnit[];
  assignments: DivisionAssignment[];
}) {
  const [selectedId, setSelectedId] = useState(personnel[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => personnel.filter((member) =>
    [member.displayName, member.personnelId, member.rank, member.callSign ?? "", member.primaryAssignment]
      .join(" ").toLowerCase().includes(query.trim().toLowerCase())
  ), [personnel, query]);
  const selected = personnel.find((member) => member.id === selectedId);
  const memberAssignments = assignments.filter((item) => item.profileId === selectedId);

  return (
    <div className="ops-stack">
      <section className="portal-panel">
        <div className="portal-panel-heading">
          <div><p>Personnel assignment</p><h2>Select a department member</h2></div>
          <span>{personnel.length} personnel</span>
        </div>
        <p className="personnel-section-intro">Divisions are operational assignments, not certifications. Assigning a division does not change a member&apos;s rank or permissions.</p>
        <div className="personnel-assignment-form">
          <label>
            <span>Find personnel</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, callsign, or rank" />
          </label>
          <label>
            <span>Personnel</span>
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {filtered.map((member) => <option key={member.id} value={member.id}>
                {member.callSign ?? member.personnelId} · {member.rank} {member.displayName}
              </option>)}
            </select>
          </label>
        </div>
        {!filtered.length ? <p className="personnel-section-intro">No personnel match your search.</p> : null}
      </section>
      {selected ? (
        <PersonnelAssignmentManager
          key={selected.id}
          profileId={selected.id}
          displayName={selected.displayName}
          units={units}
          assignments={memberAssignments.map((item) => ({
            id: item.id,
            unitId: item.unitId,
            unitName: item.unitName,
            unitType: item.unitType,
            assignmentType: item.assignmentType,
            startsAt: item.startsAt,
            notes: item.notes,
          }))}
          canManage={true}
        />
      ) : <div className="portal-empty-state"><strong>No personnel records found.</strong></div>}
    </div>
  );
}
