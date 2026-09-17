"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { invokePersonnelAdmin } from "@/lib/supabase/personnel-admin";
import { PersonnelIdentityManager } from "./PersonnelIdentityManager";
import { PersonnelLoaManager } from "./PersonnelLoaManager";

type MemberOption = {
  profileId: string;
  personnelId: string;
  displayName: string;
  rank: string;
  status: string;
  callSign: string;
  isTestAccount: boolean;
  activeLeave: {
    id: string;
    leaveType: string;
    startsOn: string;
    expectedReturnOn: string;
  } | null;
};

const STANDARD_CALL_SIGN = /^S-4[0-9]{2}$/;
const TEST_CALL_SIGN = /^TA-[0-9]{1,3}$/;

export function RosterPersonnelControls({ members }: { members: MemberOption[] }) {
  const router = useRouter();
  const [rankOpen, setRankOpen] = useState(false);
  const [loaOpen, setLoaOpen] = useState(false);
  const [callSignOpen, setCallSignOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(members[0]?.profileId ?? "");
  const [callSignError, setCallSignError] = useState("");
  const [callSignNotice, setCallSignNotice] = useState("");
  const [callSignPending, setCallSignPending] = useState(false);
  const selected = useMemo(() => members.find((member) => member.profileId === selectedId) ?? members[0], [members, selectedId]);

  if (!members.length) return null;

  function chooseMember(profileId: string) {
    setSelectedId(profileId);
    setCallSignError("");
    setCallSignNotice("");
  }

  async function updateCallSign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || callSignPending) return;

    const form = new FormData(event.currentTarget);
    const callSign = String(form.get("callSign") ?? "").trim().toUpperCase();
    const reason = String(form.get("reason") ?? "").trim();
    const valid = selected.isTestAccount ? TEST_CALL_SIGN.test(callSign) : STANDARD_CALL_SIGN.test(callSign);

    setCallSignError("");
    setCallSignNotice("");

    if (!valid) {
      setCallSignError(selected.isTestAccount ? "Test call sign must use TA-#, such as TA-1." : "Call sign must use S-4##, such as S-417.");
      return;
    }
    if (reason.length < 4) {
      setCallSignError("Enter a short reason for the call-sign assignment.");
      return;
    }

    setCallSignPending(true);
    try {
      await invokePersonnelAdmin({
        operation: "assign_call_sign",
        profile_id: selected.profileId,
        call_sign: callSign,
        reason,
      });
      setCallSignNotice(`${callSign} is now assigned to ${selected.displayName}. The roster has been updated.`);
      router.refresh();
    } catch (error) {
      setCallSignError(error instanceof Error ? error.message : "The call sign could not be updated.");
    } finally {
      setCallSignPending(false);
    }
  }

  return (
    <>
      <section className="portal-control-banner">
        <div>
          <span>Roster personnel controls</span>
          <strong>Manage call signs, rank, service status, and administrative LOA directly from the roster.</strong>
          <p>All changes use the shared personnel record, so the roster and personnel record stay in sync without a separate update.</p>
        </div>
        <div className="portal-control-actions">
          <button className="portal-button portal-button--primary" onClick={() => { setCallSignError(""); setCallSignNotice(""); setCallSignOpen(true); }} type="button">Assign / Change Call Sign</button>
          <button className="portal-button" onClick={() => setRankOpen(true)} type="button">Promote / Change Rank</button>
          <button className="portal-button" onClick={() => setLoaOpen(true)} type="button">Record / End LOA</button>
        </div>
      </section>

      {callSignOpen && selected ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setCallSignOpen(false); }}>
          <section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="roster-call-sign-manager-title">
            <div className="portal-modal-heading">
              <div><span>Roster personnel controls</span><h2 id="roster-call-sign-manager-title">Assign / Change Call Sign</h2></div>
              <button onClick={() => setCallSignOpen(false)} type="button" aria-label="Close call sign manager">×</button>
            </div>
            <form onSubmit={updateCallSign}>
              <label className="portal-call-sign-field">
                Personnel member
                <select value={selected.profileId} onChange={(event) => chooseMember(event.target.value)}>
                  {members.map((member) => <option key={member.profileId} value={member.profileId}>{member.personnelId} · {member.displayName} · {member.callSign || "No call sign"}</option>)}
                </select>
              </label>
              <label className="portal-call-sign-field">
                Operational call sign
                <input
                  key={`${selected.profileId}-${selected.callSign}`}
                  autoFocus
                  defaultValue={selected.callSign || (selected.isTestAccount ? "TA-" : "S-4")}
                  maxLength={selected.isTestAccount ? 6 : 5}
                  name="callSign"
                  placeholder={selected.isTestAccount ? "TA-1" : "S-4##"}
                  required
                />
              </label>
              <label className="portal-call-sign-field">
                Assignment reason
                <textarea name="reason" placeholder="Initial assignment, reassignment, unit change, etc." required rows={3} />
              </label>
              <p className="portal-call-sign-note">This writes to the same personnel record the department roster uses. Existing call-sign history is retained by the personnel system.</p>
              {callSignError ? <div className="portal-form-error" role="alert">{callSignError}</div> : null}
              {callSignNotice ? <div className="portal-form-success" role="status"><strong>Call sign updated</strong><span>{callSignNotice}</span></div> : null}
              <div className="portal-modal-actions">
                <button className="portal-button portal-button--secondary" disabled={callSignPending} onClick={() => setCallSignOpen(false)} type="button">Close</button>
                <button className="portal-button portal-button--primary" disabled={callSignPending} type="submit">{callSignPending ? "Updating…" : "Update call sign"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {rankOpen && selected ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setRankOpen(false); }}>
          <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="roster-rank-manager-title">
            <div className="portal-modal-heading">
              <div><span>Roster personnel controls</span><h2 id="roster-rank-manager-title">Promote / Change Rank</h2></div>
              <button onClick={() => setRankOpen(false)} type="button" aria-label="Close rank manager">×</button>
            </div>
            <label className="portal-call-sign-field">
              Personnel member
              <select value={selected.profileId} onChange={(event) => chooseMember(event.target.value)}>
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
              <select value={selected.profileId} onChange={(event) => chooseMember(event.target.value)}>
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
