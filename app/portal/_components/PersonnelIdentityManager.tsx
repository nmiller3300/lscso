"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  profileId: string;
  personnelId: string;
  displayName: string;
  currentRank: string;
  currentStatus: string;
};

const ranks = [
  "Sheriff","Undersheriff","Major","Captain","1st Lieutenant","Lieutenant","Sergeant","Corporal","Master Deputy","Deputy III","Deputy II","Deputy","Recruit",
];
const statuses = ["Active","Acting","Suspended"];
const tierForRank: Record<string,string> = {
  Sheriff:"Executive",Undersheriff:"Executive",Major:"Command",Captain:"Command","1st Lieutenant":"Command",Lieutenant:"Supervisor",Sergeant:"Supervisor",Corporal:"Preliminary","Master Deputy":"Deputy","Deputy III":"Deputy","Deputy II":"Deputy",Deputy:"Deputy",Recruit:"Deputy",
};

export function PersonnelIdentityManager({ profileId, personnelId, displayName, currentRank, currentStatus }: Props) {
  const router = useRouter();
  const [rank, setRank] = useState(currentRank);
  const [status, setStatus] = useState(currentStatus);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const role = useMemo(() => tierForRank[rank] ?? "Unknown", [rank]);
  const changed = rank !== currentRank || status !== currentStatus;

  async function save() {
    if (!changed || pending) return;
    setPending(true);
    setError("");
    setNotice("");

    const reasons: string[] = [];
    if (rank !== currentRank) reasons.push(`Rank change: ${currentRank} to ${rank}`);
    if (status !== currentStatus) reasons.push(`Status change: ${currentStatus} to ${status}`);

    const { error: rpcError } = await (createClient() as any).rpc("roster_update_personnel_rank_status", {
      p_profile_id: profileId,
      p_rank: rank,
      p_status: status,
      p_reason: reasons.join("; ") || "Roster personnel change",
    });
    setPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setNotice(`${displayName} updated. FiveM/QBox synchronization is queued automatically when a linked character exists.`);
    router.refresh();
  }

  return (
    <section className="portal-panel personnel-admin-control personnel-admin-control--identity">
      <div className="portal-panel-heading">
        <div><p>Personnel management</p><h2>Rank & status</h2></div>
        <span>{personnelId}</span>
      </div>
      <p className="personnel-admin-control__intro">Change the member&apos;s official rank or service status. Portal access and the linked LSCSO QBox job are synchronized from this roster record.</p>

      <div className="personnel-admin-fields personnel-admin-fields--identity">
        <label><span>Rank</span><select value={rank} onChange={(event) => setRank(event.target.value)}>{ranks.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="personnel-admin-derived"><span>Portal role</span><input value={role} readOnly /><small>Assigned automatically from rank</small></label>
        <label><span>Service status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>

      <div className="personnel-admin-actions">
        <span>{changed ? "Unsaved personnel change" : "No pending changes"}</span>
        <button className="portal-button portal-button--primary" disabled={!changed || pending} onClick={() => void save()} type="button">{pending ? "Saving…" : "Apply change"}</button>
      </div>
      {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
      {notice ? <div className="portal-form-success" role="status"><strong>Personnel updated</strong><span>{notice}</span></div> : null}
    </section>
  );
}
