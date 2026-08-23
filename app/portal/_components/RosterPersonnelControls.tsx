"use client";

import { useMemo, useState } from "react";
import { PersonnelIdentityManager } from "./PersonnelIdentityManager";

type MemberOption = {
  profileId: string;
  personnelId: string;
  displayName: string;
  rank: string;
  status: string;
};

export function RosterPersonnelControls({ members }: { members: MemberOption[] }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(members[0]?.profileId ?? "");
  const selected = useMemo(() => members.find((member) => member.profileId === selectedId) ?? members[0], [members, selectedId]);

  if (!members.length) return null;

  return (
    <>
      <section className="portal-control-banner">
        <div>
          <span>Roster personnel controls</span>
          <strong>Promote, demote, or change personnel status directly from the roster.</strong>
          <p>Rank changes automatically synchronize the member's portal role and write career and audit history.</p>
        </div>
        <div className="portal-control-actions">
          <button className="portal-button portal-button--primary" onClick={() => setOpen(true)} type="button">Promote / Change Rank</button>
        </div>
      </section>

      {open && selected ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
          <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="roster-rank-manager-title">
            <div className="portal-modal-heading">
              <div><span>Roster personnel controls</span><h2 id="roster-rank-manager-title">Promote / Change Rank</h2></div>
              <button onClick={() => setOpen(false)} type="button" aria-label="Close rank manager">×</button>
            </div>
            <label className="portal-call-sign-field">
              Personnel member
              <select value={selected.profileId} onChange={(event) => setSelectedId(event.target.value)}>
                {members.map((member) => <option key={member.profileId} value={member.profileId}>{member.personnelId} · {member.displayName} · {member.rank}</option>)}
              </select>
            </label>
            <PersonnelIdentityManager
              key={`${selected.profileId}-${selected.rank}-${selected.status}`}
              profileId={selected.profileId}
              personnelId={selected.personnelId}
              displayName={selected.displayName}
              currentRank={selected.rank}
              currentStatus={selected.status}
            />
            <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" onClick={() => setOpen(false)} type="button">Close</button></div>
          </section>
        </div>
      ) : null}
    </>
  );
}
