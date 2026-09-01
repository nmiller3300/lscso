"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Person = { id: string; personnel_id: string; display_name: string; rank: string; call_sign: string | null };
type Flag = { id: string; profile_id: string; flag_type: string; notes: string | null; created_at: string };
type Award = { id: string; profile_id: string; award_name: string; citation: string; awarded_on: string };
type Action = "award" | "flag" | "restore";

const awardTypes = ["Medal of Valor", "Medal of Merit", "Life Saving Award", "Distinguished Service Award"] as const;
const medalAssetPaths: Record<(typeof awardTypes)[number], string> = {
  "Medal of Valor": "/images/medals/medal-of-valor.jpeg",
  "Medal of Merit": "/images/medals/medal-of-merit.jpeg",
  "Life Saving Award": "/images/medals/life-saving-award.jpeg",
  "Distinguished Service Award": "/images/medals/distinguished-service-award.jpeg",
};
const flagTypes = ["Promotion Eligible", "Promotion Hold", "Training Required", "Certification Deficiency", "Administrative Review", "Probationary", "FTO Eligible", "Supervisor Eligible", "Command Review Required", "Return From LOA Review", "Restricted Duty", "Separation Pending"];

const actionDetails: Record<Action, { step: string; title: string; description: string }> = {
  award: { step: "Recognition", title: "Issue medal", description: "Add a permanent decoration and its supporting citation." },
  flag: { step: "Administration", title: "Add personnel flag", description: "Record a visible administrative indicator without creating a Guardian." },
  restore: { step: "Accountability", title: "Restore points", description: "Apply an authorized disciplinary-point restoration." },
};

export function ServiceRecordWorkspace({ personnel, flags, awards }: { personnel: Person[]; flags: Flag[]; awards: Award[] }) {
  const router = useRouter();
  const [selectedPersonId, setSelectedPersonId] = useState(personnel[0]?.id ?? "");
  const [action, setAction] = useState<Action>("award");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const people = useMemo(() => new Map(personnel.map((person) => [person.id, person])), [personnel]);
  const selectedPerson = people.get(selectedPersonId);

  async function award(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const medal = String(form.get("award")) as (typeof awardTypes)[number];
    setPending(true);
    const { error } = await (createClient() as any).rpc("issue_personnel_award", { target_profile_id: selectedPersonId, award_type: medal, citation_text: String(form.get("citation") ?? "").trim(), award_date: String(form.get("awardDate") ?? "") || new Date().toISOString().slice(0, 10), asset_path: medalAssetPaths[medal] });
    setPending(false);
    if (error) return setNotice(error.message);
    setNotice("Medal issued and added to the permanent service record.");
    router.refresh();
  }

  async function addFlag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const { error } = await (createClient() as any).rpc("add_personnel_flag", { target_profile_id: selectedPersonId, flag_name: String(form.get("flag")), flag_notes: String(form.get("notes") ?? "").trim() || null });
    setPending(false);
    if (error) return setNotice(error.message);
    setNotice("Personnel flag added and audited.");
    router.refresh();
  }

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get("restorationType"));
    const supabase = createClient() as any;
    setPending(true);
    const result = type === "Outstanding Performance"
      ? await supabase.rpc("award_outstanding_performance", { target_profile_id: selectedPersonId, reason_text: String(form.get("reason") ?? "") })
      : await supabase.rpc("award_commendation_restoration", { target_profile_id: selectedPersonId, restore_points: Number(form.get("points") ?? 1), reason_text: String(form.get("reason") ?? "") });
    setPending(false);
    if (result.error) return setNotice(result.error.message);
    setNotice(`Disciplinary restoration processed. Current score: ${result.data?.points ?? "updated"}.`);
    router.refresh();
  }

  async function resolveFlag(id: string) {
    setPending(true);
    const { error } = await (createClient() as any).rpc("resolve_personnel_flag", { flag_id: id, resolution_notes: "Resolved through Command Service Records" });
    setPending(false);
    if (error) return setNotice(error.message);
    setNotice("Personnel flag resolved.");
    router.refresh();
  }

  return (
    <div className="service-record-workspace">
      <section className="portal-panel service-record-subject">
        <div className="portal-panel-heading"><div><p>Step 1</p><h2>Choose personnel</h2></div><span>One member at a time</span></div>
        <div className="service-record-subject-row">
          <label><span>Personnel record</span><select value={selectedPersonId} onChange={(event) => setSelectedPersonId(event.target.value)}>{personnel.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {person.rank}{person.call_sign ? ` · ${person.call_sign}` : ""}</option>)}</select></label>
          {selectedPerson ? <div><span>Selected member</span><strong>{selectedPerson.display_name}</strong><small>{selectedPerson.rank} · {selectedPerson.personnel_id}</small></div> : null}
          {selectedPerson ? <Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${selectedPerson.personnel_id}`}>Open full record</Link> : null}
        </div>
      </section>

      <section className="portal-panel service-record-actions">
        <div className="portal-panel-heading"><div><p>Step 2</p><h2>Choose a service-record action</h2></div></div>
        <div className="service-record-action-grid" role="tablist" aria-label="Service record actions">
          {(Object.entries(actionDetails) as Array<[Action, (typeof actionDetails)[Action]]>).map(([id, item]) => <button className={action === id ? "is-active" : ""} key={id} onClick={() => { setAction(id); setNotice(""); }} role="tab" aria-selected={action === id} type="button"><span>{item.step}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}
        </div>
      </section>

      <div className="service-record-main-grid">
        <section className="portal-panel service-record-form">
          <div className="portal-panel-heading"><div><p>Step 3 · {actionDetails[action].step}</p><h2>{actionDetails[action].title}</h2></div><span>{selectedPerson?.display_name ?? "Select personnel"}</span></div>

          {action === "award" ? <form onSubmit={award}><label>Medal<select name="award">{awardTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label>Citation<textarea required minLength={10} name="citation" rows={6} placeholder="Document why this decoration is being awarded..." /></label><label>Award date<input name="awardDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending || !selectedPersonId}>Issue medal</button></div></form> : null}

          {action === "flag" ? <form onSubmit={addFlag}><label>Flag type<select name="flag">{flagTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label>Administrative notes<textarea name="notes" rows={6} placeholder="Explain why this flag is being added and what resolves it." /></label><div className="portal-form-protection"><strong>Administrative indicator only</strong><span>A flag does not replace a Guardian and does not change disciplinary points.</span></div><div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending || !selectedPersonId}>Add flag</button></div></form> : null}

          {action === "restore" ? <form onSubmit={restore}><div className="portal-form-grid"><label>Restoration type<select name="restorationType"><option>Outstanding Performance</option><option>Commendation Restoration</option></select></label><label>Points<select name="points"><option value="1">1 point</option><option value="2">2 points</option><option value="3">3 points</option></select></label></div><label>Reason<textarea required minLength={4} name="reason" rows={5} placeholder="State the qualifying performance or commendation." /></label><div className="portal-form-protection"><strong>Rules enforced automatically</strong><span>Restoration cannot create stored credit or reduce a score below zero. Monthly limits remain enforced.</span></div><div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending || !selectedPersonId}>Apply restoration</button></div></form> : null}
          {notice ? <div className="personnel-inline-notice" role="status">{notice}</div> : null}
        </section>

        <aside className="service-record-activity">
          <section className="portal-panel"><div className="portal-panel-heading"><div><p>Active administration</p><h2>Personnel flags</h2></div><span>{flags.length}</span></div><div className="service-record-compact-list">{flags.slice(0, 8).map((flag) => { const person = people.get(flag.profile_id); return <article key={flag.id}><div><strong>{flag.flag_type}</strong><span>{person?.display_name ?? "Personnel"}</span><small>{flag.notes ?? "No note"}</small></div><button disabled={pending} onClick={() => resolveFlag(flag.id)} type="button">Resolve</button></article>; })}{!flags.length ? <div className="portal-empty-state"><strong>No active personnel flags.</strong></div> : null}</div></section>
          <section className="portal-panel"><div className="portal-panel-heading"><div><p>Recent recognition</p><h2>Medals</h2></div><span>{awards.length}</span></div><div className="service-record-compact-list">{awards.slice(0, 8).map((award) => <article key={award.id}><div><strong>{award.award_name}</strong><span>{people.get(award.profile_id)?.display_name ?? "Personnel"} · {new Date(award.awarded_on).toLocaleDateString()}</span></div></article>)}{!awards.length ? <div className="portal-empty-state"><strong>No medals have been issued.</strong></div> : null}</div></section>
        </aside>
      </div>
    </div>
  );
}
