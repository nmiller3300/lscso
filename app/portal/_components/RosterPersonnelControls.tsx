"use client";

import { useMemo, useState } from "react";
import { PersonnelIdentityManager } from "./PersonnelIdentityManager";
import { PersonnelLoaManager } from "./PersonnelLoaManager";

type MemberOption = {
  profileId: string;
  personnelId: string;
  displayName: string;
  rank: string;
  status: string;
  activeLeave: {
    id: string;
    leaveType: string;
    startsOn: string;
    expectedReturnOn: string;
  } | null;
};

export function RosterPersonnelControls({ members }: { members: MemberOption[] }) {
  const [rankOpen, setRankOpen] = useState(false);
  const [loaOpen, setLoaOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(members[0]?.profileId ?? "");
  const selected = useMemo(() => members.find((member) => member.profileId === selectedId) ?? members[0], [members, selectedId]);

  if (!members.length) return null;

  return (
    <>
      <section className="portal-control-banner">
        <div>
          <span>Roster personnel controls</span>
          <strong>Manage rank, service status, and administrative LOA directly from the roster.</strong>
          <p>Rank/status changes use the shared personnel record. Approved LOA records automatically update website and roster display status while the leave dates are active.</p>
        </div>
        <div className="portal-control-actions">
          <button className="portal-button portal-button--primary" onClick={() => setRankOpen(true)} type="button">Promote / Change Rank</button>
          <button className="portal-button" onClick={() => setLoaOpen(true)} type="button">Record / End LOA</button>
        </div>
      </section>

      {rankOpen && selected ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setRankOpen(false); }}>
          <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="roster-rank-manager-title">
            <div className="portal-modal-heading">
              <div><span>Roster personnel controls</span><h2 id="roster-rank-manager-title">Promote / Change Rank</h2></div>
              <button onClick={() => setRankOpen(false)} type="button" aria-label="Close rank manager">×</button>
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
            <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" onClick={() => setRankOpen(false)} type="button">Close</button></div>
          </section>
        </div>
      ) : null}

      {loaOpen && selected ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setLoaOpen(false); }}>
          <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="roster-loa-manager-title">
            <div className="portal-modal-heading">
              <div><span>Roster personnel controls</span><h2 id="roster-loa-manager-title">Record / End LOA</h2></div>
              <button onClick={() => setLoaOpen(false)} type="button" aria-label="Close LOA manager">×</button>
            </div>
            <label className="portal-call-sign-field">
              Personnel member
              <select value={selected.profileId} onChange={(event) => setSelectedId(event.target.value)}>
                {members.map((member) => <option key={member.profileId} value={member.profileId}>{member.personnelId} · {member.displayName} · {member.rank}{member.activeLeave ? " · LOA" : ""}</option>)}
              </select>
            </label>
            <PersonnelLoaManager
              key={`${selected.profileId}-${selected.activeLeave?.id ?? "no-loa"}`}
              profileId={selected.profileId}
              personnelId={selected.personnelId}
              displayName={selected.displayName}
              activeLeave={selected.activeLeave}
            />
            <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" onClick={() => setLoaOpen(false)} type="button">Close</button></div>
          </section>
        </div>
      ) : null}
    </>
  );
}
