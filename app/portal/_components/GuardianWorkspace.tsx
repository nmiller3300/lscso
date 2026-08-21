"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

type GuardianKind = "feedback" | "warning" | "writeup" | "commendation";

type GuardianRecord = {
  databaseId: string;
  id: string;
  type: string;
  member: string;
  author: string;
  subjectProfileId: string;
  authorProfileId: string;
  status: string;
  due: string;
  pointsAssessed: number;
  escalationOverride: boolean;
};

type PersonnelOption = {
  id: string;
  displayName: string;
  rank: string;
  callSign: string | null;
  isTestAccount: boolean;
};

type PointTier = {
  id: number;
  minPoints: number;
  maxPoints: number;
  name: string;
  action: string;
  color: string;
};

const countedPointStatuses = new Set([
  "Approved",
  "Issued",
  "Awaiting Acknowledgment",
  "Acknowledged",
  "Follow-Up Due",
  "Closed",
]);

function localDateInputValue(date = new Date()) {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
}

const guardianTypes: Record<GuardianKind, {
  label: string;
  short: string;
  purpose: string;
  approval: string;
  action: string;
  tone: string;
}> = {
  feedback: {
    label: "Feedback",
    short: "FB",
    purpose: "Document a coaching conversation, expectation, or verbal correction.",
    approval: "Supervisor may issue directly",
    action: "Issue Guardian",
    tone: "blue",
  },
  warning: {
    label: "Written Warning",
    short: "WW",
    purpose: "Formally identify conduct requiring documented correction and follow-up.",
    approval: "Command approval required before issue",
    action: "Submit for Command Review",
    tone: "amber",
  },
  writeup: {
    label: "Write-Up",
    short: "WU",
    purpose: "Document a serious or repeated performance, conduct, or policy concern.",
    approval: "Command approval required before issue",
    action: "Submit for Command Review",
    tone: "red",
  },
  commendation: {
    label: "Commendation",
    short: "CM",
    purpose: "Recognize exceptional judgment, service, initiative, or performance.",
    approval: "Supervisor may issue directly",
    action: "Issue Guardian",
    tone: "green",
  },
};

const conductCategories = [
  "Attendance / readiness",
  "Communication",
  "Decision-making",
  "Officer safety",
  "Policy / procedure",
  "Professional conduct",
  "Report quality",
  "Service / initiative",
];

const positiveCategories = [
  "Community service",
  "Exceptional judgment",
  "Leadership",
  "Life safety",
  "Professional initiative",
  "Team contribution",
];

export function GuardianWorkspace() {
  const currentProfile = usePortalProfile();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<GuardianKind>("feedback");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Communication"]);
  const [records, setRecords] = useState<GuardianRecord[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelOption[]>([]);
  const [pointTiers, setPointTiers] = useState<PointTier[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [pointsAssessed, setPointsAssessed] = useState(0);
  const [escalationOverride, setEscalationOverride] = useState(false);
  const [processingRecordId, setProcessingRecordId] = useState<string | null>(null);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [notice, setNotice] = useState("");
  const [formKey, setFormKey] = useState(0);

  const config = guardianTypes[kind];
  const categories = kind === "commendation" ? positiveCategories : conductCategories;
  const requiresApproval = kind === "warning" || kind === "writeup";
  const visibleRecords = showAllRecords ? records : records.slice(0, 4);
  const currentMemberPoints = records
    .filter((record) => record.subjectProfileId === selectedMemberId && countedPointStatuses.has(record.status))
    .reduce((sum, record) => sum + record.pointsAssessed, 0);
  const projectedPoints = currentMemberPoints + (kind === "commendation" ? 0 : pointsAssessed);
  const projectedTier = pointTiers.find((tier) =>
    projectedPoints >= tier.minPoints && (projectedPoints <= tier.maxPoints || tier.maxPoints === 10),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadGuardianData() {
      const supabase = createClient();
      const [{ data: profileRows }, { data: guardianRows }, { data: tierRows }] = await Promise.all([
        supabase.from("personnel_profiles").select("id,display_name,rank,call_sign,is_test_account").neq("status", "Deactivated").order("personnel_id"),
        supabase.from("guardian_records").select("id,guardian_number,subject_profile_id,author_profile_id,record_type,status,follow_up_due_at,created_at,points_assessed,escalation_override").order("created_at", { ascending: false }),
        supabase.from("disciplinary_point_tiers").select("id,min_points,max_points,tier_name,action_required,color_key").order("sort_order"),
      ]);

      if (cancelled) return;
      const options = (profileRows ?? []).map((profile) => ({
        id: profile.id,
        displayName: profile.display_name,
        rank: profile.rank,
        callSign: profile.call_sign,
        isTestAccount: profile.is_test_account,
      }));
      const names = new Map(options.map((profile) => [profile.id, profile.displayName]));
      setPersonnel(options);
      setPointTiers((tierRows ?? []).map((tier) => ({
        id: tier.id,
        minPoints: tier.min_points,
        maxPoints: tier.max_points,
        name: tier.tier_name,
        action: tier.action_required,
        color: tier.color_key,
      })));
      setRecords((guardianRows ?? []).map((record) => ({
        databaseId: record.id,
        id: `G-${String(record.guardian_number).padStart(4, "0")}`,
        type: record.record_type,
        member: names.get(record.subject_profile_id) ?? "Restricted personnel",
        author: names.get(record.author_profile_id) ?? "Command",
        subjectProfileId: record.subject_profile_id,
        authorProfileId: record.author_profile_id,
        status: record.status,
        due: record.follow_up_due_at ? new Date(record.follow_up_due_at).toLocaleDateString() : "No follow-up",
        pointsAssessed: record.points_assessed,
        escalationOverride: record.escalation_override,
      })));
    }

    void loadGuardianData();
    return () => { cancelled = true; };
  }, []);

  function toggleCategory(category: string) {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  }

  function selectKind(nextKind: GuardianKind) {
    setKind(nextKind);
    setPointsAssessed(0);
    setEscalationOverride(false);
    setSelectedCategories(nextKind === "commendation" ? ["Exceptional judgment"] : ["Communication"]);
  }

  async function persistGuardian(status: string) {
    const form = formRef.current ? new FormData(formRef.current) : new FormData();
    const subjectProfileId = String(form.get("member") ?? "");
    const subject = personnel.find((member) => member.id === subjectProfileId);
    if (!subject) throw new Error("Select a personnel member before saving this Guardian.");

    const eventDate = String(form.get("eventDate") ?? new Date().toISOString().slice(0, 10));
    const followUpDate = String(form.get("followUpDate") ?? "");
    const title = `${config.label}: ${selectedCategories[0] ?? "Personnel action"}`;
    const supabase = createClient();

    const { data, error } = await supabase.from("guardian_records").insert({
      subject_profile_id: subjectProfileId,
      author_profile_id: currentProfile.id,
      record_type: config.label,
      status,
      title,
      incident_at: new Date(`${eventDate}T12:00:00`).toISOString(),
      location: String(form.get("division") ?? ""),
      policy_reference: String(form.get("policy") ?? "") || null,
      observed_behavior: String(form.get("observedConduct") ?? "") || null,
      expected_standard: String(form.get("direction") ?? form.get("impact") ?? "") || null,
      action_taken: String(form.get("recognition") ?? "") || null,
      follow_up_plan: String(form.get("followUpType") ?? "") || null,
      follow_up_due_at: followUpDate ? new Date(`${followUpDate}T17:00:00`).toISOString() : null,
      structured_fields: {
        categories: selectedCategories,
        reference: String(form.get("reference") ?? ""),
        confidentiality: String(form.get("confidentiality") ?? ""),
        pattern: String(form.get("pattern") ?? ""),
        impact: String(form.get("impact") ?? ""),
        context: String(form.get("context") ?? ""),
        response_window: String(form.get("responseWindow") ?? ""),
        allow_response: form.get("allowResponse") === "on",
      },
      points_assessed: kind === "commendation" ? 0 : Number(form.get("pointsAssessed") ?? 0),
      escalation_override: kind === "commendation" ? false : form.get("escalationOverride") === "on",
      escalation_reason: kind === "commendation" ? null : String(form.get("escalationReason") ?? "").trim() || null,
      submitted_at: status === "Draft" ? null : new Date().toISOString(),
      issued_at: status === "Awaiting Acknowledgment" ? new Date().toISOString() : null,
      is_test_record: subject.isTestAccount,
    }).select("id,guardian_number,record_type,status,follow_up_due_at").single();

    if (error || !data) throw new Error(error?.message ?? "The Guardian could not be saved.");

    return {
      databaseId: data.id,
      id: `G-${String(data.guardian_number).padStart(4, "0")}`,
      type: data.record_type,
      member: subject.displayName,
      author: currentProfile.display_name,
      subjectProfileId,
      authorProfileId: currentProfile.id,
      status: data.status,
      due: data.follow_up_due_at ? new Date(data.follow_up_due_at).toLocaleDateString() : "No follow-up",
      pointsAssessed: kind === "commendation" ? 0 : Number(form.get("pointsAssessed") ?? 0),
      escalationOverride: kind === "commendation" ? false : form.get("escalationOverride") === "on",
    } satisfies GuardianRecord;
  }

  async function saveDraft() {
    try {
      const record = await persistGuardian("Draft");
      setRecords((current) => [record, ...current]);
      setNotice(`${record.id} saved securely as a draft.`);
      window.setTimeout(() => setNotice(""), 3400);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Guardian could not be saved.");
    }
  }

  async function submitGuardian(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const status = requiresApproval ? "Pending Approval" : "Awaiting Acknowledgment";
    let record: GuardianRecord;
    try {
      record = await persistGuardian(status);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Guardian could not be submitted.");
      return;
    }
    setRecords((current) => [record, ...current]);
    setFormKey((current) => current + 1);
    setSelectedMemberId("");
    setPointsAssessed(0);
    setEscalationOverride(false);
    setSelectedCategories(kind === "commendation" ? ["Exceptional judgment"] : ["Communication"]);
    setNotice(
      requiresApproval
        ? `${record.id} routed to the Command approval queue.`
        : `${record.id} issued for personnel acknowledgment.`,
    );
    window.setTimeout(() => setNotice(""), 3800);
  }

  function clearForm() {
    setFormKey((current) => current + 1);
    setSelectedMemberId("");
    setPointsAssessed(0);
    setEscalationOverride(false);
    setSelectedCategories(kind === "commendation" ? ["Exceptional judgment"] : ["Communication"]);
  }

  async function reviewGuardian(record: GuardianRecord, decision: "Approved" | "Denied") {
    setProcessingRecordId(record.databaseId);
    const { data, error } = await createClient().rpc("review_guardian", {
      record_id: record.databaseId,
      decision,
      review_notes: decision === "Denied" ? "Declined by command." : "Approved for supervisor issue.",
    });
    setProcessingRecordId(null);
    if (error || !data) {
      setNotice(error?.message ?? "The command decision could not be saved.");
      return;
    }
    setRecords((current) => current.map((item) => item.databaseId === record.databaseId ? { ...item, status: data.status } : item));
    setNotice(`${record.id} ${decision === "Approved" ? "approved" : "declined"}. The action was written to the audit log.`);
    window.setTimeout(() => setNotice(""), 3800);
  }

  async function issueGuardian(record: GuardianRecord) {
    setProcessingRecordId(record.databaseId);
    const { data, error } = await createClient().rpc("issue_guardian", { record_id: record.databaseId });
    setProcessingRecordId(null);
    if (error || !data) {
      setNotice(error?.message ?? "The Guardian could not be issued.");
      return;
    }
    setRecords((current) => current.map((item) => item.databaseId === record.databaseId ? { ...item, status: data.status } : item));
    setNotice(`${record.id} issued to ${record.member} for acknowledgment.`);
    window.setTimeout(() => setNotice(""), 3800);
  }

  return (
    <>
      <section className="guardian-intro-panel">
        <div>
          <span>Structured action records</span>
          <strong>Organized enough to guide the supervisor. Flexible enough to capture what matters.</strong>
          <p>Required selections create consistency; focused narrative fields preserve context and professional judgment.</p>
        </div>
        <div className="guardian-protection-chips">
          <span>Case number auto-generated</span>
          <span>Immutable after issue</span>
          <span>Amendments remain visible</span>
          <span>Acknowledgment ≠ agreement</span>
        </div>
      </section>

      <div className="guardian-layout">
        <section className="guardian-builder">
          <div className="guardian-step-heading">
            <span>Step 01</span>
            <div><strong>Select the Guardian type</strong><small>The workflow adjusts automatically.</small></div>
          </div>
          <div className="guardian-type-grid">
            {(Object.entries(guardianTypes) as Array<[GuardianKind, (typeof guardianTypes)[GuardianKind]]>).map(([id, item]) => (
              <button className={kind === id ? `is-active guardian-tone--${item.tone}` : undefined} key={id} onClick={() => selectKind(id)} type="button">
                <span>{item.short}</span>
                <strong>{item.label}</strong>
                <small>{item.purpose}</small>
                <b>{item.approval}</b>
              </button>
            ))}
          </div>

          <form key={`${kind}-${formKey}`} onSubmit={submitGuardian} ref={formRef}>
            <div className="guardian-form-section">
              <div className="guardian-step-heading">
                <span>Step 02</span>
                <div><strong>Member and event</strong><small>Establish who, when, and where.</small></div>
              </div>
              <div className="portal-form-grid portal-form-grid--three">
                <label>
                  Personnel member
                  <select name="member" onChange={(event) => setSelectedMemberId(event.target.value)} required value={selectedMemberId}>
                    <option disabled value="">Select from assigned personnel</option>
                    {personnel.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName} · {member.rank}{member.isTestAccount ? " · Test Account" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Event date
                  <input defaultValue={localDateInputValue()} name="eventDate" type="date" />
                </label>
                <label>
                  Event / reference number
                  <input name="reference" placeholder="Optional CAD, case, or training ID" />
                </label>
                <label>
                  Primary division
                  <select defaultValue="Patrol Division" name="division">
                    <option>Patrol Division</option><option>Training & FTO</option><option>Internal Affairs</option><option>Office of the Sheriff</option>
                  </select>
                </label>
                <label>
                  Supervisor of record
                  <select defaultValue={currentProfile.id} disabled name="supervisor">
                    <option value={currentProfile.id}>{currentProfile.display_name} · {currentProfile.rank}</option>
                  </select>
                </label>
                <label>
                  Confidentiality
                  <select defaultValue="Standard personnel record" name="confidentiality">
                    <option>Standard personnel record</option><option>Command restricted</option><option>Internal Affairs sealed</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="guardian-form-section">
              <div className="guardian-step-heading">
                <span>Step 03</span>
                <div><strong>{kind === "commendation" ? "Recognition categories" : "Conduct categories"}</strong><small>Select every category that applies.</small></div>
              </div>
              <div className="guardian-category-grid">
                {categories.map((category) => (
                  <label className={selectedCategories.includes(category) ? "is-selected" : undefined} key={category}>
                    <input
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                      type="checkbox"
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
              {kind !== "commendation" ? (
                <>
                  <div className="guardian-policy-row">
                    <label>
                      Related standard / policy
                      <select defaultValue="Professional Conduct" name="policy">
                        <option>Professional Conduct</option><option>Attendance & Readiness</option><option>Report Writing</option><option>Use of Discretion</option><option>Supervisory Direction</option>
                      </select>
                    </label>
                    <label>
                      Pattern
                      <select defaultValue="First documented occurrence" name="pattern">
                        <option>First documented occurrence</option><option>Repeated concern</option><option>Escalated from Feedback</option><option>Serious single incident</option>
                      </select>
                    </label>
                  </div>
                  <div className="guardian-points-assessment">
                    <div>
                      <span>Disciplinary points</span>
                      <strong>{selectedMemberId ? `${currentMemberPoints} current → ${projectedPoints} projected` : "Select a member to calculate the tier"}</strong>
                      <small>Only approved or issued negative Guardians count toward the member’s active total.</small>
                    </div>
                    <label>
                      Points assessed
                      <select name="pointsAssessed" onChange={(event) => setPointsAssessed(Number(event.target.value))} value={pointsAssessed}>
                        {Array.from({ length: 11 }, (_, value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                    <div className={`guardian-tier-preview guardian-tier-preview--${projectedTier?.color ?? "green"}`}>
                      <span>Projected tier</span>
                      <strong>{projectedTier?.name ?? "Good Standing"}</strong>
                      <small>{projectedTier?.action ?? "No action — member is in full compliance."}</small>
                    </div>
                  </div>
                  <label className="portal-checkbox-row guardian-escalation-check">
                    <input checked={escalationOverride} name="escalationOverride" onChange={(event) => setEscalationOverride(event.target.checked)} type="checkbox" />
                    <span><strong>Apply escalation clause</strong><small>Command and Internal Affairs may escalate based on severity, pattern, or circumstances. Points are a floor—not a ceiling.</small></span>
                  </label>
                  {escalationOverride ? (
                    <label className="guardian-escalation-reason">
                      Escalation reason
                      <textarea name="escalationReason" placeholder="Document the severity, pattern, or circumstances supporting escalation..." required rows={3} />
                    </label>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="guardian-form-section">
              <div className="guardian-step-heading">
                <span>Step 04</span>
                <div><strong>{kind === "commendation" ? "Recognition narrative" : "Guided narrative"}</strong><small>Short, specific fields replace one oversized text box.</small></div>
              </div>
              <div className="guardian-narrative-grid">
                <label>
                  {kind === "commendation" ? "What did the member do?" : "Observed conduct or performance"}
                  <textarea name="observedConduct" required placeholder={kind === "commendation" ? "Describe the member’s specific actions..." : "State the observable facts without conclusions or labels..."} rows={5} />
                  <small>Focus on dates, actions, statements, and directly observed behavior.</small>
                </label>
                <label>
                  {kind === "commendation" ? "Positive impact" : "Operational or professional impact"}
                  <textarea name="impact" required placeholder={kind === "commendation" ? "Explain the benefit to the public, team, or mission..." : "Explain how the conduct affected safety, service, readiness, policy, or the team..."} rows={5} />
                  <small>Connect the record to a department standard or measurable outcome.</small>
                </label>
                {kind !== "commendation" ? (
                  <label>
                    Expected standard and corrective direction
                    <textarea name="direction" required placeholder="State the expected behavior and the specific correction required..." rows={5} />
                    <small>The member should be able to understand exactly what successful correction looks like.</small>
                  </label>
                ) : (
                  <label>
                    Recommended recognition
                    <textarea name="recognition" placeholder="Note any award, announcement, assignment consideration, or personnel-file recognition..." rows={5} />
                    <small>Optional recommendation; command may approve additional recognition separately.</small>
                  </label>
                )}
                <label>
                  Supervisor context
                  <textarea name="context" placeholder="Add relevant context, prior coaching, supporting facts, or mitigating circumstances..." rows={5} />
                  <small>Clearly distinguish context from the observable event.</small>
                </label>
              </div>
            </div>

            <div className="guardian-form-section guardian-followup-section">
              <div className="guardian-step-heading">
                <span>Step 05</span>
                <div><strong>Follow-up and acknowledgment</strong><small>Define what happens after issue.</small></div>
              </div>
              <div className="portal-form-grid portal-form-grid--three">
                <label>
                  Follow-up required
                  <select defaultValue={kind === "commendation" ? "No follow-up" : "Supervisor check-in"} name="followUpType">
                    <option>No follow-up</option><option>Supervisor check-in</option><option>Training assignment</option><option>Performance observation</option><option>Command review</option>
                  </select>
                </label>
                <label>
                  Follow-up date
                  <input name="followUpDate" type="date" />
                </label>
                <label>
                  Member response window
                  <select defaultValue="72 hours" name="responseWindow">
                    <option>24 hours</option><option>48 hours</option><option>72 hours</option><option>5 days</option><option>No response required</option>
                  </select>
                </label>
              </div>
              <label className="portal-checkbox-row">
                <input defaultChecked name="allowResponse" type="checkbox" />
                <span><strong>Allow written rebuttal or response</strong><small>The response is preserved beside the Guardian and does not alter the original record.</small></span>
              </label>
            </div>

            <div className={`guardian-route-card guardian-tone--${config.tone}`}>
              <div>
                <span>{config.short}</span>
                <div><strong>{config.label} routing</strong><small>{config.approval}</small></div>
              </div>
              <ol>
                <li className="is-current"><span>1</span>Supervisor completes record</li>
                {requiresApproval ? <li><span>2</span>Command approves or returns</li> : null}
                <li><span>{requiresApproval ? "3" : "2"}</span>Supervisor issues Guardian</li>
                <li><span>{requiresApproval ? "4" : "3"}</span>Member acknowledges / responds</li>
              </ol>
            </div>

            <div className="guardian-form-actions">
              <button className="portal-text-button" onClick={clearForm} type="button">Clear form</button>
              <div>
                <button className="portal-button portal-button--secondary" onClick={saveDraft} type="button">Save draft</button>
                <button className="portal-button portal-button--primary" type="submit">{config.action}</button>
              </div>
            </div>
          </form>
        </section>

        <aside className="guardian-queue">
          <div className="guardian-queue-heading">
            <span>Guardian activity</span>
            <strong>{records.length} shared records</strong>
          </div>
          {visibleRecords.map((record) => (
            <article key={record.id}>
              <div>
                <span>{record.type.slice(0, 2).toUpperCase()}</span>
                <div><strong>{record.id}</strong><small>{record.type}</small></div>
              </div>
              <h3>{record.member}</h3>
              <p>Created by {record.author}</p>
              <div className="guardian-record-status"><span>{record.status}</span><small>{record.pointsAssessed} point{record.pointsAssessed === 1 ? "" : "s"} · {record.due}</small></div>
              {record.status === "Pending Approval" && ["Executive", "Command"].includes(currentProfile.access_tier) ? (
                <div className="guardian-record-actions">
                  <button disabled={processingRecordId === record.databaseId} onClick={() => reviewGuardian(record, "Denied")} type="button">Decline</button>
                  <button disabled={processingRecordId === record.databaseId} onClick={() => reviewGuardian(record, "Approved")} type="button">Approve</button>
                </div>
              ) : null}
              {record.status === "Approved" && record.authorProfileId === currentProfile.id ? (
                <div className="guardian-record-actions">
                  <button className="is-primary" disabled={processingRecordId === record.databaseId} onClick={() => issueGuardian(record)} type="button">Issue to member</button>
                </div>
              ) : null}
            </article>
          ))}
          <div className="guardian-queue-actions">
            <button className="portal-text-button" onClick={() => setShowAllRecords((current) => !current)} type="button">
              {showAllRecords ? "Show recent records" : "View all Guardian records"} →
            </button>
          </div>
          <div className="guardian-queue-protection">
            <strong>Record integrity</strong>
            <span>Once issued, the original remains locked. Corrections are added as attributed amendments.</span>
          </div>
        </aside>
      </div>

      <section className="guardian-point-policy" aria-labelledby="guardian-point-policy-title">
        <div className="portal-section-heading">
          <div><p>Department standard</p><h2 id="guardian-point-policy-title">Disciplinary point tiers</h2></div>
          <span>Command and Internal Affairs retain escalation authority when severity or pattern requires it.</span>
        </div>
        <div className="guardian-point-table" role="table" aria-label="LSCSO disciplinary point tiers">
          <div className="guardian-point-table-heading" role="row">
            <strong role="columnheader">Points</strong><strong role="columnheader">Tier</strong><strong role="columnheader">Action required</strong>
          </div>
          {pointTiers.map((tier) => (
            <div key={tier.id} role="row">
              <strong role="cell">{tier.minPoints === tier.maxPoints ? tier.minPoints : `${tier.minPoints}–${tier.maxPoints}`}</strong>
              <span className={`guardian-tier-dot guardian-tier-dot--${tier.color}`} role="cell">{tier.name}</span>
              <p role="cell">{tier.action}</p>
            </div>
          ))}
        </div>
        <div className="guardian-escalation-clause"><strong>Escalation clause</strong><span>Command and Internal Affairs may immediately escalate an infraction to a higher tier based on severity, a pattern of behavior, or circumstances that demand it. Point accumulation is a floor, not a ceiling.</span></div>
      </section>

      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
