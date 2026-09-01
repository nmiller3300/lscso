"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

type RequestKind = "promotion" | "transfer" | "certification" | "record";

type RouteEvent = {
  id: string;
  eventType: string;
  stageLabel: string;
  reviewerLabel: string | null;
  actorLabel: string | null;
  detail: string | null;
  createdAt: string;
};

type PersonnelRequest = {
  databaseId: string;
  id: string;
  kind: RequestKind;
  label: string;
  submitted: string;
  status: string;
  routingStage: string;
  routingLabel: string;
  reviewerLabel: string;
  requestedUnitName: string | null;
  events: RouteEvent[];
};

type DivisionOption = { id: string; name: string };

const requestTypes: Record<RequestKind, { short: string; label: string; description: string; routing: string }> = {
  promotion: {
    short: "PR",
    label: "Promotion consideration",
    description: "Submit qualifications and a command-interest statement.",
    routing: "Direct supervisor → Executive Command",
  },
  transfer: {
    short: "DT",
    label: "Division transfer",
    description: "Request reassignment with chain-of-command routing.",
    routing: "Direct supervisor → Receiving division → Executive Command",
  },
  certification: {
    short: "CR",
    label: "Certification addition",
    description: "Submit proof and route it to Training for validation.",
    routing: "Training & Recruitment → Personnel file",
  },
  record: {
    short: "RR",
    label: "Record review",
    description: "Ask Personnel Command to review a possible record issue.",
    routing: "Executive Command → Attributed resolution",
  },
};

const typeToKind: Record<string, RequestKind> = {
  Promotion: "promotion",
  "Division Transfer": "transfer",
  Certification: "certification",
  Other: "record",
};

const kindToDatabaseType: Record<RequestKind, "Promotion" | "Division Transfer" | "Certification" | "Other"> = {
  promotion: "Promotion",
  transfer: "Division Transfer",
  certification: "Certification",
  record: "Other",
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function nextAction(request: PersonnelRequest) {
  if (["Approved", "Denied", "Cancelled", "Completed"].includes(request.status)) return "No further action required";
  if (request.routingStage === "Supervisor Review") return "Awaiting supervisor review";
  if (request.routingStage === "Receiving Division Review") return "Awaiting receiving-division review";
  if (request.routingStage === "Training Review") return "Awaiting Training & Recruitment review";
  if (request.routingStage === "Executive Command") return "Awaiting Executive Command decision";
  return "Awaiting routed review";
}

export function DeputyRequestCenter() {
  const profile = usePortalProfile();
  const [selectedKind, setSelectedKind] = useState<RequestKind | null>(null);
  const [requests, setRequests] = useState<PersonnelRequest[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [notice, setNotice] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  async function loadRequests() {
    const supabase = createClient() as any;
    const { data: requestRows } = await supabase
      .from("personnel_requests")
      .select("id,request_number,request_type,status,created_at,routing_stage,routing_label,current_reviewer_label,requested_unit_id")
      .eq("requester_profile_id", profile.id)
      .order("created_at", { ascending: false });

    const ids = (requestRows ?? []).map((row: any) => row.id);
    const [eventResult, unitResult] = await Promise.all([
      ids.length
        ? supabase.from("personnel_request_route_events").select("id,request_id,event_type,stage_label,reviewer_label,actor_label,detail,created_at").in("request_id", ids).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase.from("organizational_units").select("id,name,unit_type,active").eq("active", true).eq("unit_type", "Division").order("sort_order").order("name"),
    ]);

    const unitNames = new Map((unitResult.data ?? []).map((unit: any) => [unit.id, unit.name]));
    const eventsByRequest = new Map<string, RouteEvent[]>();
    for (const event of eventResult.data ?? []) {
      const list = eventsByRequest.get(event.request_id) ?? [];
      list.push({
        id: event.id,
        eventType: event.event_type,
        stageLabel: event.stage_label,
        reviewerLabel: event.reviewer_label,
        actorLabel: event.actor_label,
        detail: event.detail,
        createdAt: event.created_at,
      });
      eventsByRequest.set(event.request_id, list);
    }

    setDivisions((unitResult.data ?? [])
      .filter((unit: any) => unit.name !== profile.division && unit.name !== "Office of the Sheriff")
      .map((unit: any) => ({ id: unit.id, name: unit.name })));

    setRequests((requestRows ?? []).map((row: any): PersonnelRequest => {
      const kind = typeToKind[row.request_type] ?? "record";
      return {
        databaseId: row.id,
        id: `RQ-${String(row.request_number).padStart(4, "0")}`,
        kind,
        label: requestTypes[kind].label,
        submitted: formatWhen(row.created_at),
        status: row.status,
        routingStage: row.routing_stage ?? "Routing pending",
        routingLabel: row.routing_label ?? "Routing pending",
        reviewerLabel: row.current_reviewer_label ?? (row.status === "Approved" ? "Completed" : row.status === "Denied" ? "Closed" : "Command routing pending"),
        requestedUnitName: row.requested_unit_id ? unitNames.get(row.requested_unit_id) ?? "Requested division" : null,
        events: eventsByRequest.get(row.id) ?? [],
      };
    }));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await loadRequests();
      if (cancelled) return;
    }
    void load();
    return () => { cancelled = true; };
    // profile identity is stable for the lifetime of the portal session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const openCount = useMemo(() => requests.filter((request) => !["Approved", "Denied", "Cancelled", "Completed"].includes(request.status)).length, [requests]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedKind || submittingRequest) return;

    const form = new FormData(event.currentTarget);
    const requestType = requestTypes[selectedKind];
    const requestSummary = String(form.get("requestSummary") ?? "").trim();
    const requestedUnitId = selectedKind === "transfer" ? String(form.get("requestedUnitId") ?? "").trim() : "";

    if (requestSummary.length < 10) {
      setNotice("Add a brief operational explanation before submitting this request.");
      return;
    }
    if (selectedKind === "transfer" && !requestedUnitId) {
      setNotice("Choose the division you are requesting before submitting the transfer.");
      return;
    }

    setSubmittingRequest(true);
    const supabase = createClient() as any;
    const { data, error } = await supabase.from("personnel_requests").insert({
      requester_profile_id: profile.id,
      request_type: kindToDatabaseType[selectedKind],
      subject: requestType.label,
      details: requestSummary,
      requested_effective_at: form.get("effectiveDate") ? new Date(`${String(form.get("effectiveDate"))}T12:00:00`).toISOString() : null,
      requested_unit_id: requestedUnitId || null,
      status: "Submitted",
      is_test_record: profile.is_test_account,
    }).select("request_number,routing_label,current_reviewer_label").single();

    setSubmittingRequest(false);
    if (error || !data) {
      setNotice(error?.message ?? "The request could not be submitted.");
      return;
    }

    const id = `RQ-${String(data.request_number).padStart(4, "0")}`;
    setSelectedKind(null);
    setNotice(`${id} submitted. Current reviewer: ${data.current_reviewer_label ?? data.routing_label ?? "Executive Command"}.`);
    await loadRequests();
    window.setTimeout(() => setNotice(""), 5200);
  }

  return (
    <section className="deputy-request-section" id="requests">
      <div className="portal-section-heading">
        <div><p>Self-service workflow</p><h2>Requests</h2></div>
        <span>{openCount ? `${openCount} request${openCount === 1 ? "" : "s"} currently in review` : "Routing follows current organizational authority automatically."}</span>
      </div>

      <div className="deputy-request-grid">
        {(Object.entries(requestTypes) as Array<[RequestKind, (typeof requestTypes)[RequestKind]]>).map(([kind, item]) => (
          <button key={kind} onClick={() => setSelectedKind(kind)} type="button">
            <span>{item.short}</span><strong>{item.label}</strong><small>{item.description}</small><b>Begin request →</b>
          </button>
        ))}
      </div>

      {requests.length ? (
        <div className="deputy-request-history request-routing-history">
          <div className="portal-panel-heading"><div><p>Submitted requests</p><h2>Request status & routing</h2></div><span>Live chain of command</span></div>
          {requests.map((request) => (
            <article className="request-routing-card" key={request.id}>
              <span>{requestTypes[request.kind].short}</span>
              <div className="request-routing-main">
                <strong>{request.label}</strong>
                <small>{request.id} · Submitted {request.submitted}</small>
                {request.requestedUnitName ? <small>Requested division: {request.requestedUnitName}</small> : null}
                <div className="request-routing-status">
                  <div><span>Currently with</span><strong>{request.reviewerLabel}</strong></div>
                  <div><span>Routing stage</span><strong>{request.routingLabel}</strong></div>
                  <div><span>Next required action</span><strong>{nextAction(request)}</strong></div>
                </div>
                {request.events.length ? (
                  <details className="request-route-events">
                    <summary>View routing history <span>{request.events.length} events</span></summary>
                    <div>
                      {request.events.map((event) => (
                        <article key={event.id}>
                          <span>{event.eventType}</span>
                          <strong>{event.stageLabel}</strong>
                          <small>{formatWhen(event.createdAt)}{event.actorLabel ? ` · ${event.actorLabel}` : ""}</small>
                          {event.detail ? <p>{event.detail}</p> : null}
                        </article>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
              <b>{request.status}</b>
            </article>
          ))}
        </div>
      ) : null}

      {selectedKind ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedKind(null); }}>
          <section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="request-form-title">
            <div className="portal-modal-heading">
              <div><span>{requestTypes[selectedKind].routing}</span><h2 id="request-form-title">{requestTypes[selectedKind].label}</h2></div>
              <button onClick={() => setSelectedKind(null)} type="button" aria-label="Close request form">×</button>
            </div>
            <form onSubmit={submitRequest}>
              <label className="portal-call-sign-field">Request summary<textarea name="requestSummary" required placeholder="Explain what you are requesting and the operational reason..." rows={5} /></label>
              <div className="portal-form-grid">
                <label>Preferred effective date<input name="effectiveDate" type="date" /></label>
                {selectedKind === "transfer" ? (
                  <label>Requested division<select name="requestedUnitId" required defaultValue=""><option value="" disabled>Select division</option>{divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></label>
                ) : (
                  <label>Routing<select aria-label="Automatic routing" disabled defaultValue="automatic"><option value="automatic">Automatic chain of command</option></select></label>
                )}
              </div>
              <div className="portal-form-protection"><strong>Automatic secure routing</strong><span>{requestTypes[selectedKind].routing}. If the required supervisor or unit reviewer has not been assigned yet, the request automatically escalates to Sheriff / Undersheriff rather than sitting unassigned.</span></div>
              <div className="portal-modal-actions">
                <button className="portal-button portal-button--secondary" disabled={submittingRequest} onClick={() => setSelectedKind(null)} type="button">Cancel</button>
                <button className="portal-button portal-button--primary" disabled={submittingRequest} type="submit">{submittingRequest ? "Submitting…" : "Submit request"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </section>
  );
}
