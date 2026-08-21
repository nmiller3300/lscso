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
const statuses = ["Active","Acting","Suspended","Deactivated"];
const tierForRank: Record<string,string> = {
  Sheriff:"Executive",Undersheriff:"Executive",Major:"Command",Captain:"Command","1st Lieutenant":"Command",Lieutenant:"Supervisor",Sergeant:"Supervisor",Corporal:"Preliminary","Master Deputy":"Deputy","Deputy III":"Deputy","Deputy II":"Deputy",Deputy:"Deputy",Recruit:"Deputy",
};

export function PersonnelIdentityManager({ profileId, personnelId, displayName, currentRank, currentStatus }: Props) {
  const router = useRouter();
  const [rank, setRank] = useState(currentRank);
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const role = useMemo(() => tierForRank[rank] ?? "Unknown", [rank]);
  const changed = rank !== currentRank || status !== currentStatus;

  async function save() {
    if (!changed || pending) return;
    if (reason.trim().length < 4) {
      setError("Enter a short reason for the personnel change.");
      return;
    }
    setPending(true); setError(""); setNotice("");
    const { error: rpcError } = await (createClient() as any).rpc("v2_update_personnel_identity", {
      p_profile_id: profileId,
      p_rank: rank,
      p_status: status,
      p_reason: reason.trim(),
    });
    setPending(false);
    if (rpcError) { setError(rpcError.message); return; }
    setNotice(`${displayName} updated. Rank, portal role, career history, and audit record were synchronized.`);
    setReason("");
    router.refresh();
  }

  return (
    <section className="portal-panel">
      <div className="portal-panel-heading"><div><p>Personnel management</p><h2>Rank, role & status</h2></div><span>{personnelId}</span></div>
      <p className="command-v2-compact-copy">Sheriff, Undersheriff, or Major approval is required. Portal role is synchronized from rank so authority cannot drift into an invalid combination.</p>
      <div className="portal-inline-form-grid">
        <label><span>Rank</span><select value={rank} onChange={(e)=>setRank(e.target.value)}>{ranks.map((item)=><option key={item}>{item}</option>)}</select></label>
        <label><span>Portal role</span><input value={role} readOnly /></label>
        <label><span>Status</span><select value={status} onChange={(e)=>setStatus(e.target.value)}>{statuses.map((item)=><option key={item}>{item}</option>)}</select></label>
        <label className="portal-inline-form-wide"><span>Reason / authority note</span><input value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Promotion, demotion, correction, acting status, etc." /></label>
      </div>
      <div className="portal-inline-actions"><button className="portal-button portal-button--primary" disabled={!changed || pending} onClick={()=>void save()} type="button">{pending ? "Saving…" : "Apply personnel change"}</button></div>
      {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </section>
  );
}
