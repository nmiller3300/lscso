"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

type PersonnelGuardian = {
  databaseId?: string;
  id: string;
  type: string;
  issued: string;
  author: string;
  status: string;
  pointsAssessed?: number;
  fingerprintId?: string | null;
  incidentAt?: string;
  location?: string;
  policyReference?: string;
  observedBehavior?: string;
  expectedStandard?: string;
  actionTaken?: string;
  followUpPlan?: string;
};

type RequestKind = "promotion" | "transfer" | "certification" | "record";

type PersonnelRequest = {
  id: string;
  kind: RequestKind;
  label: string;
  submitted: string;
  status: string;
};

const requestTypes: Record<RequestKind, { short: string; label: string; description: string; routing: string }> = {
  promotion: {
    short: "PR",
    label: "Promotion consideration",
    description: "Submit qualifications and a command-interest statement.",
    routing: "Supervisor recommendation → Command review",
  },
  transfer: {
    short: "DT",
    label: "Division transfer",
    description: "Request reassignment with supervisor routing.",
    routing: "Current supervisor → Receiving command",
  },
  certification: {
    short: "CR",
    label: "Certification addition",
    description: "Submit proof and route it to Training for validation.",
    routing: "Training Unit verification → Personnel file",
  },
  record: {
    short: "RR",
    label: "Record review",
    description: "Ask Personnel Command to review a possible record issue.",
    routing: "Personnel Command → Attributed resolution",
  },
};

export function DeputyGuardianRecords({ records }: { records: PersonnelGuardian[] }) {
  const profile = usePortalProfile();
  const [visibleRecords, setVisibleRecords] = useState(records);
  const [selectedRecord, setSelectedRecord] = useState<PersonnelGuardian | null>(null);
  const [showRights, setShowRights] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [signatureName, setSignatureName] = useState("");
  const [responseText, setResponseText] = useState("");
  const [submittingAcknowledgment, setSubmittingAcknowledgment] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRecords() {
      const supabase = createClient();
      const [{ data: guardianRows }, { data: profileRows }, { data: acknowledgmentRows }] = await Promise.all([
        supabase.from("guardian_records").select("id,guardian_number,record_type,status,issued_at,created_at,incident_at,location,policy_reference,observed_behavior,expected_standard,action_taken,follow_up_plan,author_profile_id,points_assessed").eq("subject_profile_id", profile.id).order("created_at", { ascending: false }),
        supabase.from("personnel_profiles").select("id,display_name"),
        supabase.from("guardian_acknowledgments").select("guardian_id,fingerprint_id").eq("profile_id", profile.id),
      ]);
      if (cancelled) return;

      const authorNames = new Map((profileRows ?? []).map((item) => [item.id, item.display_name]));
      const fingerprints = new Map((acknowledgmentRows ?? []).map((item) => [item.guardian_id, item.fingerprint_id]));
      const shared = (guardianRows ?? []).map((record): PersonnelGuardian => ({
        databaseId: record.id,
        id: `G-${String(record.guardian_number).padStart(4, "0")}`,
        type: record.record_type,
        issued: new Date(record.issued_at ?? record.created_at).toLocaleDateString(),
        author: authorNames.get(record.author_profile_id) ?? "Command",
        status: record.status,
        pointsAssessed: record.points_assessed,
        fingerprintId: fingerprints.get(record.id) ?? null,
        incidentAt: new Date(record.incident_at).toLocaleDateString(),
        location: record.location ?? "Not specified",
        policyReference: record.policy_reference ?? "Not specified",
        observedBehavior: record.observed_behavior ?? "No narrative was entered.",
        expectedStandard: record.expected_standard ?? "Not specified",
        actionTaken: record.action_taken ?? "Not specified",
        followUpPlan: record.follow_up_plan ?? "No follow-up specified",
      }));
      setVisibleRecords(shared.length ? shared : records);
      setAcknowledged(shared.filter((item) => ["Acknowledged", "Closed"].includes(item.status)).map((item) => item.id));
    }

    void loadRecords();
    return () => { cancelled = true; };
  }, [profile.id, records]);

  async function acknowledgeRecord() {
    if (!selectedRecord?.databaseId) return;
    const isNegative = selectedRecord.type !== "Commendation";
    const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    if (isNegative && normalizeName(signatureName) !== normalizeName(profile.display_name)) {
      setNotice(`Type your full personnel name exactly as shown: ${profile.display_name}.`);
      return;
    }
    setSubmittingAcknowledgment(true);
    const { data, error } = await createClient().rpc("acknowledge_guardian", {
      record_id: selectedRecord.databaseId,
      signature_name: isNegative ? signatureName.trim() : "",
      response_text: responseText.trim(),
    });
    setSubmittingAcknowledgment(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    const result = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    const fingerprintId = typeof result?.fingerprint_id === "string" ? result.fingerprint_id : null;
    setAcknowledged((current) => current.includes(selectedRecord.id) ? current : [...current, selectedRecord.id]);
    setVisibleRecords((current) => current.map((record) => record.id === selectedRecord.id ? { ...record, status: "Acknowledged", fingerprintId } : record));
    setSelectedRecord(null);
    setSignatureName("");
    setResponseText("");
    setNotice(fingerprintId ? `Guardian acknowledged. Receipt fingerprint: ${fingerprintId}` : "Guardian receipt acknowledged. This does not indicate agreement with the record.");
    window.setTimeout(() => setNotice(""), 6200);
  }

  function openRecord(record: PersonnelGuardian) {
    setSignatureName("");
    setResponseText("");
    setSelectedRecord(record);
  }

  return (
    <>
      <section className="portal-panel deputy-guardian-panel" id="guardians">
        <div className="portal-panel-heading">
          <div><p>Acknowledgment records</p><h2>Guardian documents</h2></div>
          <span>Acknowledgment confirms receipt—not agreement</span>
        </div>
        <div className="deputy-guardian-table">
          {visibleRecords.map((record) => {
            const isAcknowledged = acknowledged.includes(record.id) || record.status === "Acknowledged" || record.status === "Closed";
            return (
              <article key={record.id}>
                <span className={`portal-record-type portal-record-type--${record.type.toLowerCase()}`}>{record.type.slice(0, 2).toUpperCase()}</span>
                <div><strong>{record.type}</strong><small>{record.id}</small></div>
                <div><small>Issued</small><strong>{record.issued}</strong></div>
                <div><small>Supervisor</small><strong>{record.author}</strong></div>
                <b>{isAcknowledged ? "Acknowledged" : record.status}</b>
                <button onClick={() => openRecord(record)} type="button">View record →</button>
              </article>
            );
          })}
        </div>
        <div className="deputy-record-rights">
          <div><strong>Your record protections</strong><span>You may acknowledge receipt, submit a written response, and view every attributed amendment.</span></div>
          <button onClick={() => setShowRights(true)} type="button">Review response & appeal policy</button>
        </div>
      </section>

      {selectedRecord ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedRecord(null); }}>
          <section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="guardian-record-title">
            <div className="portal-modal-heading">
              <div><span>{selectedRecord.id} · Personnel Guardian</span><h2 id="guardian-record-title">{selectedRecord.type}</h2></div>
              <button onClick={() => setSelectedRecord(null)} type="button" aria-label="Close Guardian record">×</button>
            </div>
            <div className="deputy-guardian-detail">
              <div><span>Event date</span><strong>{selectedRecord.incidentAt ?? selectedRecord.issued}</strong></div>
              <div><span>Issued</span><strong>{selectedRecord.issued}</strong></div>
              <div><span>Supervisor</span><strong>{selectedRecord.author}</strong></div>
              <div><span>Status</span><strong>{selectedRecord.status}</strong></div>
              <div><span>Disciplinary points</span><strong>{selectedRecord.pointsAssessed ?? 0}</strong></div>
              <div><span>Division / location</span><strong>{selectedRecord.location ?? "Not specified"}</strong></div>
              <div><span>Policy / standard</span><strong>{selectedRecord.policyReference ?? "Not specified"}</strong></div>
              <div><span>Follow-up</span><strong>{selectedRecord.followUpPlan ?? "No follow-up specified"}</strong></div>
              <div><span>Record protection</span><strong>Original locked · Amendments attributed</strong></div>
            </div>
            <div className="deputy-guardian-narrative">
              <article><span>Observed conduct or performance</span><p>{selectedRecord.observedBehavior ?? "No narrative was entered."}</p></article>
              <article><span>Expected standard / impact</span><p>{selectedRecord.expectedStandard ?? "Not specified"}</p></article>
              {selectedRecord.actionTaken && selectedRecord.actionTaken !== "Not specified" ? <article><span>Recognition / action</span><p>{selectedRecord.actionTaken}</p></article> : null}
            </div>
            {selectedRecord.fingerprintId ? (
              <div className="guardian-fingerprint-receipt">
                <span>Acknowledgment fingerprint</span>
                <strong>{selectedRecord.fingerprintId}</strong>
                <small>Internal receipt identifier · Not a legal signature</small>
              </div>
            ) : null}
            <div className="portal-form-protection"><strong>Shared personnel record</strong><span>The issued Guardian, acknowledgment state, response history, and attributed command actions are stored in the protected department database.</span></div>
            {!acknowledged.includes(selectedRecord.id) && !["Acknowledged", "Closed"].includes(selectedRecord.status) ? (
              <div className="guardian-acknowledgment-form">
                {selectedRecord.type !== "Commendation" ? (
                  <label>
                    Typed signature
                    <input autoComplete="name" onChange={(event) => setSignatureName(event.target.value)} placeholder={`Type your name (${profile.display_name})`} value={signatureName} />
                    <small>By typing your name, you acknowledge receipt only—not agreement. This is an internal department acknowledgment, not a legal signature.</small>
                  </label>
                ) : null}
                <label>
                  Written response <span>Optional</span>
                  <textarea onChange={(event) => setResponseText(event.target.value)} placeholder="Add context or a response that should remain attached to this Guardian..." rows={4} value={responseText} />
                </label>
                <div className="guardian-no-ip-notice"><strong>Privacy protection</strong><span>No IP address is collected or stored with this acknowledgment.</span></div>
              </div>
            ) : null}
            <div className="portal-modal-actions">
              <button className="portal-button portal-button--secondary" onClick={() => setSelectedRecord(null)} type="button">Close</button>
              <button className="portal-button portal-button--primary" disabled={submittingAcknowledgment || acknowledged.includes(selectedRecord.id) || selectedRecord.status === "Acknowledged" || selectedRecord.status === "Closed"} onClick={acknowledgeRecord} type="button">{acknowledged.includes(selectedRecord.id) || selectedRecord.status === "Acknowledged" || selectedRecord.status === "Closed" ? "Already acknowledged" : submittingAcknowledgment ? "Saving acknowledgment…" : selectedRecord.type === "Commendation" ? "Acknowledge receipt" : "Sign & acknowledge"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {showRights ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowRights(false); }}>
          <section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="record-rights-title">
            <div className="portal-modal-heading"><div><span>Personnel protection</span><h2 id="record-rights-title">Response and appeal rights</h2></div><button onClick={() => setShowRights(false)} type="button" aria-label="Close record rights">×</button></div>
            <div className="deputy-rights-list">
              <article><span>01</span><div><strong>Acknowledgment is receipt only</strong><p>Signing or acknowledging a Guardian never means the member agrees with its contents.</p></div></article>
              <article><span>02</span><div><strong>Written response preserved</strong><p>A rebuttal or contextual response remains attached beside the original Guardian.</p></div></article>
              <article><span>03</span><div><strong>Original record remains visible</strong><p>Corrections are attributed amendments. The original cannot be silently rewritten.</p></div></article>
              <article><span>04</span><div><strong>Command review available</strong><p>Eligible records may be appealed through the documented chain of command.</p></div></article>
            </div>
            <div className="portal-modal-actions"><button className="portal-button portal-button--primary" onClick={() => setShowRights(false)} type="button">Understood</button></div>
          </section>
        </div>
      ) : null}

      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}

export function DeputyRequestCenter() {
  const profile = usePortalProfile();
  const [selectedKind, setSelectedKind] = useState<RequestKind | null>(null);
  const [requests, setRequests] = useState<PersonnelRequest[]>([]);
  const [notice, setNotice] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadRequests() {
      const { data } = await createClient().from("personnel_requests")
        .select("request_number,request_type,status,created_at")
        .eq("requester_profile_id", profile.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;

      const kindForType: Record<string, RequestKind> = {
        Promotion: "promotion",
        "Division Transfer": "transfer",
        Certification: "certification",
        Other: "record",
      };
      setRequests((data ?? []).map((request) => {
        const kind = kindForType[request.request_type] ?? "record";
        return {
          id: `RQ-${String(request.request_number).padStart(4, "0")}`,
          kind,
          label: requestTypes[kind].label,
          submitted: new Date(request.created_at).toLocaleDateString(),
          status: request.status,
        };
      }));
    }
    void loadRequests();
    return () => { cancelled = true; };
  }, [profile.id]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedKind || submittingRequest) return;
    const form = new FormData(event.currentTarget);
    const requestType = requestTypes[selectedKind];
    const requestSummary = String(form.get("requestSummary") ?? "").trim();
    if (requestSummary.length < 10) {
      setNotice("Add a brief operational explanation before submitting this request.");
      return;
    }
    const databaseType: Record<RequestKind, "Promotion" | "Division Transfer" | "Certification" | "Other"> = {
      promotion: "Promotion",
      transfer: "Division Transfer",
      certification: "Certification",
      record: "Other",
    };
    setSubmittingRequest(true);
    const { data, error } = await createClient().from("personnel_requests").insert({
      requester_profile_id: profile.id,
      request_type: databaseType[selectedKind],
      subject: requestType.label,
      details: requestSummary,
      requested_effective_at: form.get("effectiveDate") ? new Date(`${String(form.get("effectiveDate"))}T12:00:00`).toISOString() : null,
      status: "Submitted",
      is_test_record: profile.is_test_account,
    }).select("request_number,status,created_at").single();
    if (error || !data) {
      setSubmittingRequest(false);
      setNotice(error?.message ?? "The request could not be submitted.");
      return;
    }
    const request: PersonnelRequest = {
      id: `RQ-${String(data.request_number).padStart(4, "0")}`,
      kind: selectedKind,
      label: requestType.label,
      submitted: new Date(data.created_at).toLocaleDateString(),
      status: data.status,
    };
    setRequests((current) => [request, ...current]);
    setSelectedKind(null);
    setSubmittingRequest(false);
    setNotice(`${request.id} submitted to ${requestType.routing}.`);
    window.setTimeout(() => setNotice(""), 3800);
  }

  return (
    <section className="deputy-request-section" id="requests">
      <div className="portal-section-heading">
        <div><p>Self-service workflow</p><h2>Requests</h2></div>
        <span>Every request shows its reviewer, status, history, and next required action.</span>
      </div>
      <div className="deputy-request-grid">
        {(Object.entries(requestTypes) as Array<[RequestKind, (typeof requestTypes)[RequestKind]]>).map(([kind, item]) => (
          <button key={kind} onClick={() => setSelectedKind(kind)} type="button"><span>{item.short}</span><strong>{item.label}</strong><small>{item.description}</small><b>Begin request →</b></button>
        ))}
      </div>

      {requests.length ? (
        <div className="deputy-request-history">
          <div className="portal-panel-heading"><div><p>Submitted requests</p><h2>Request history</h2></div></div>
          {requests.map((request) => (
            <article key={request.id}><span>{requestTypes[request.kind].short}</span><div><strong>{request.label}</strong><small>{request.id} · Submitted {request.submitted}</small></div><b>{request.status}</b></article>
          ))}
        </div>
      ) : null}

      {selectedKind ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedKind(null); }}>
          <section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="request-form-title">
            <div className="portal-modal-heading"><div><span>{requestTypes[selectedKind].routing}</span><h2 id="request-form-title">{requestTypes[selectedKind].label}</h2></div><button onClick={() => setSelectedKind(null)} type="button" aria-label="Close request form">×</button></div>
            <form onSubmit={submitRequest}>
              <label className="portal-call-sign-field">Request summary<textarea name="requestSummary" required placeholder="Explain what you are requesting and the operational reason..." rows={5} /></label>
              <div className="portal-form-grid">
                <label>Preferred effective date<input name="effectiveDate" type="date" /></label>
                <label>Current routing<select defaultValue="Chain of command"><option>Chain of command</option></select></label>
              </div>
              <div className="portal-form-protection"><strong>Secure routing</strong><span>{requestTypes[selectedKind].routing}. You will receive a notification whenever the reviewer changes its status.</span></div>
              <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" disabled={submittingRequest} onClick={() => setSelectedKind(null)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={submittingRequest} type="submit">{submittingRequest ? "Submitting…" : "Submit request"}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </section>
  );
}
