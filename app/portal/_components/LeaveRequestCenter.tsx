"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

type LeaveRequest = {
  id: string;
  number: number;
  leave_type: string;
  starts_on: string;
  expected_return_on: string;
  status: string;
  created_at: string;
};

export function LeaveRequestCenter() {
  const profile = usePortalProfile();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await createClient().from("leave_requests")
        .select("id,request_number,leave_type,starts_on,expected_return_on,status,created_at")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });
      if (!cancelled) setRequests((data ?? []).map((row) => ({ ...row, number: Number(row.request_number) })));
    }
    void load();
    return () => { cancelled = true; };
  }, [profile.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    const startsOn = String(form.get("startsOn") ?? "");
    const returnOn = String(form.get("returnOn") ?? "");
    if (!startsOn || !returnOn || returnOn < startsOn) {
      setNotice("Expected return date must be on or after the LOA start date.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await createClient().from("leave_requests").insert({
      profile_id: profile.id,
      leave_type: String(form.get("leaveType") ?? "Personal"),
      starts_on: startsOn,
      expected_return_on: returnOn,
      notes: String(form.get("notes") ?? "").trim() || null,
      status: "Submitted",
    }).select("id,request_number,leave_type,starts_on,expected_return_on,status,created_at").single();
    setSubmitting(false);
    if (error || !data) {
      setNotice(error?.message ?? "The LOA request could not be submitted.");
      return;
    }
    setRequests((current) => [{ ...data, number: Number(data.request_number) }, ...current]);
    setOpen(false);
    setNotice(`LOA-${String(data.request_number).padStart(4, "0")} submitted for review.`);
    window.setTimeout(() => setNotice(""), 4200);
  }

  return (
    <section className="portal-panel" id="leave-requests">
      <div className="portal-panel-heading">
        <div><p>Personnel administration</p><h2>Leave of Absence</h2></div>
        <button className="portal-button portal-button--primary" onClick={() => setOpen(true)} type="button">Request LOA</button>
      </div>
      <div className="deputy-request-history">
        {requests.map((request) => (
          <article key={request.id}>
            <span>LOA</span>
            <div><strong>{request.leave_type} Leave</strong><small>LOA-{String(request.number).padStart(4, "0")} · {new Date(request.starts_on).toLocaleDateString()} → {new Date(request.expected_return_on).toLocaleDateString()}</small></div>
            <b>{request.status}</b>
          </article>
        ))}
        {!requests.length ? <div className="portal-empty-state"><strong>No leave requests on file.</strong></div> : null}
      </div>

      {open ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
          <section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="loa-title">
            <div className="portal-modal-heading"><div><span>Personnel request</span><h2 id="loa-title">Leave of Absence</h2></div><button onClick={() => setOpen(false)} type="button" aria-label="Close LOA form">×</button></div>
            <form onSubmit={submit}>
              <div className="portal-form-grid portal-form-grid--three">
                <label>Leave type<select name="leaveType" defaultValue="Personal"><option>Personal</option><option>Medical</option><option>Military</option><option>Family</option><option>Administrative</option><option>Other</option></select></label>
                <label>Start date<input name="startsOn" required type="date" /></label>
                <label>Expected return<input name="returnOn" required type="date" /></label>
              </div>
              <label className="portal-call-sign-field">Administrative note <span>Optional</span><textarea name="notes" rows={4} placeholder="Keep details limited to what Command needs to process the request." /></label>
              <div className="portal-form-protection"><strong>Privacy-conscious request</strong><span>Do not include private medical details. Command only needs the administrative information necessary to process leave.</span></div>
              <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" onClick={() => setOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={submitting} type="submit">{submitting ? "Submitting…" : "Submit LOA"}</button></div>
            </form>
          </section>
        </div>
      ) : null}
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </section>
  );
}
