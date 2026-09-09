"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";
import { PortalDialog } from "./PortalDialog";

type LeaveRequest = {
  id: string;
  number: number;
  leave_type: string;
  starts_on: string;
  expected_return_on: string;
  status: string;
  created_at: string;
};

const OPEN_ENDED_RETURN = "9999-12-31";

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

function formatLeaveWindow(request: LeaveRequest) {
  return request.expected_return_on === OPEN_ENDED_RETURN
    ? `${formatDate(request.starts_on)} → Open-ended`
    : `${formatDate(request.starts_on)} → ${formatDate(request.expected_return_on)}`;
}

export function LeaveRequestCenter() {
  const profile = usePortalProfile();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSheriff = profile.rank === "Sheriff";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id,request_number,leave_type,starts_on,expected_return_on,status,created_at")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setNotice("Leave requests could not be loaded. Please refresh and try again.");
        return;
      }
      setRequests((data ?? []).map((row: any) => ({ ...row, number: Number(row.request_number) })));
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
    const supabase = createClient() as any;
    const { data, error } = await supabase.rpc("submit_leave_request", {
      leave_kind: String(form.get("leaveType") ?? "Personal"),
      leave_starts_on: startsOn,
      leave_expected_return_on: returnOn,
      leave_notes: String(form.get("notes") ?? "").trim() || null,
    });
    setSubmitting(false);

    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      setNotice(error?.message ?? "The LOA could not be submitted. Please try again.");
      return;
    }

    const request = { ...row, number: Number(row.request_number) };
    setRequests((current) => [request, ...current]);
    setOpen(false);
    setNotice(isSheriff
      ? `LOA-${String(row.request_number).padStart(4, "0")} recorded. Sheriff leave does not require departmental approval.`
      : `LOA-${String(row.request_number).padStart(4, "0")} submitted for review.`);
    window.setTimeout(() => setNotice(""), 5200);
  }

  return (
    <section className="portal-panel" id="leave-requests">
      <div className="portal-panel-heading">
        <div><p>Personnel administration</p><h2>Leave of Absence</h2></div>
        <button className="portal-button portal-button--primary" onClick={() => setOpen(true)} type="button">{isSheriff ? "Record LOA" : "Request LOA"}</button>
      </div>

      <div className="deputy-request-history">
        {requests.map((request) => (
          <article key={request.id}>
            <span>LOA</span>
            <div>
              <strong>{request.leave_type} Leave</strong>
              <small>LOA-{String(request.number).padStart(4, "0")} · {formatLeaveWindow(request)}</small>
            </div>
            <b>{request.status}</b>
          </article>
        ))}
        {!requests.length ? <div className="portal-empty-state"><strong>No leave requests on file.</strong></div> : null}
      </div>

      <PortalDialog
        open={open}
        onClose={() => { if (!submitting) setOpen(false); }}
        eyebrow={isSheriff ? "Sheriff leave record" : "Personnel request"}
        title="Leave of Absence"
        description={isSheriff ? "Record your leave period directly. As Sheriff, there is no higher departmental approver in the chain of command." : "Only provide the administrative information Command needs to process your request."}
        dismissOnBackdrop={!submitting}
        footer={<><button className="portal-button portal-button--secondary" disabled={submitting} onClick={() => setOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={submitting} form="leave-request-form" type="submit">{submitting ? "Saving…" : isSheriff ? "Record LOA" : "Submit LOA"}</button></>}
      >
        <form className="portal-dialog-form" id="leave-request-form" onSubmit={submit}>
          <div className="portal-form-grid portal-form-grid--three">
            <label>Leave type<select name="leaveType" defaultValue="Personal"><option>Personal</option><option>Medical</option><option>Military</option><option>Family</option><option>Administrative</option><option>Other</option></select></label>
            <label>Start date<input name="startsOn" required type="date" /></label>
            <label>Expected return<input name="returnOn" required type="date" /></label>
          </div>
          <label>Administrative note <span>Optional</span><textarea name="notes" rows={4} placeholder="Keep details limited to what Command needs to know about the leave period." /></label>
          <div className="portal-form-protection">
            <strong>{isSheriff ? "Sheriff self-recorded leave" : "Privacy-conscious request"}</strong>
            <span>{isSheriff ? "This LOA is recorded directly as approved because the Sheriff has no higher departmental supervisor. The system keeps an audit note showing that no higher approval is required." : "Do not include private medical details. Command only needs the administrative information necessary to process leave."}</span>
          </div>
        </form>
      </PortalDialog>
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </section>
  );
}
