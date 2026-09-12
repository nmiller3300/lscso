"use client";

import { FormEvent, useState } from "react";
import {
  GEORGIA_EXEMPTION_RULE,
  GEORGIA_OPEN_RECORDS_CITATION,
  GEORGIA_OPEN_RECORDS_QUOTE,
  GEORGIA_RESPONSE_RULE,
  SAN_ANDREAS_EXEMPTION_RULE,
  SAN_ANDREAS_OPEN_RECORDS_CITATION,
  SAN_ANDREAS_OPEN_RECORDS_QUOTE,
  SAN_ANDREAS_RESPONSE_RULE,
} from "@/lib/open-records/legal";

export function OpenRecordsRequestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!acknowledged) {
      setError("Please acknowledge the open records notice before submitting.");
      return;
    }
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/open-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.get("first_name"),
          last_name: form.get("last_name"),
          email: form.get("email"),
          phone: form.get("phone"),
          organization: form.get("organization"),
          subject_name: form.get("subject_name"),
          subject_personnel_id: form.get("subject_personnel_id"),
          records_description: form.get("records_description"),
          preferred_delivery: form.get("preferred_delivery"),
          legal_acknowledgement: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The request could not be submitted.");
      setRequestNumber(String(data.request_number));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (requestNumber) {
    return (
      <section className="open-records-success" aria-live="polite">
        <p className="section-kicker section-kicker--dark">Request Received</p>
        <h2>Your request has been submitted.</h2>
        <strong>ORR-{requestNumber.padStart(5, "0")}</strong>
        <p>Keep this request number for your records. Submission does not mean every requested record is releasable. The records custodian must review responsive records for applicable exemptions, confidentiality requirements, and necessary redactions.</p>
        <p>Under the Georgia model used by LSCSO, the three-business-day requirement is a response/production rule: available records should be produced promptly, while records needing additional review may receive a timely written production estimate instead.</p>
      </section>
    );
  }

  return (
    <form className="open-records-form" onSubmit={submit}>
      <section className="open-records-law-grid" aria-label="Open records legal framework">
        <article>
          <span>United States · Georgia</span>
          <h3>{GEORGIA_OPEN_RECORDS_CITATION}</h3>
          <blockquote>“{GEORGIA_OPEN_RECORDS_QUOTE}”</blockquote>
          <p>{GEORGIA_RESPONSE_RULE}</p>
          <p>{GEORGIA_EXEMPTION_RULE}</p>
        </article>
        <article>
          <span>State of San Andreas · Roleplay Law</span>
          <h3>{SAN_ANDREAS_OPEN_RECORDS_CITATION}</h3>
          <blockquote>“{SAN_ANDREAS_OPEN_RECORDS_QUOTE}”</blockquote>
          <p>{SAN_ANDREAS_RESPONSE_RULE}</p>
          <p>{SAN_ANDREAS_EXEMPTION_RULE}</p>
        </article>
      </section>

      <section className="open-records-form-card">
        <div className="open-records-form-heading">
          <p className="section-kicker section-kicker--dark">Requester Information</p>
          <h2>Tell us who is requesting the records.</h2>
        </div>
        <div className="open-records-fields open-records-fields--two">
          <label>First name<input name="first_name" required maxLength={100} /></label>
          <label>Last name<input name="last_name" required maxLength={100} /></label>
          <label>Email<input type="email" name="email" required maxLength={254} /></label>
          <label>Phone<input type="tel" name="phone" maxLength={50} /></label>
          <label className="open-records-field-wide">Organization / agency <span>(optional)</span><input name="organization" maxLength={160} /></label>
        </div>
      </section>

      <section className="open-records-form-card">
        <div className="open-records-form-heading">
          <p className="section-kicker section-kicker--dark">Records Requested</p>
          <h2>Describe the existing records you want.</h2>
          <p>Be as specific as possible. An open records request seeks existing records; it does not require the agency to create a new report, summary, or compilation that does not already exist.</p>
        </div>
        <div className="open-records-fields open-records-fields--two">
          <label>Personnel member / subject <span>(optional)</span><input name="subject_name" maxLength={160} placeholder="Name of deputy or other subject" /></label>
          <label>Personnel ID <span>(optional)</span><input name="subject_personnel_id" maxLength={40} placeholder="LS-000" /></label>
          <label className="open-records-field-wide">Records description<textarea name="records_description" required minLength={10} maxLength={8000} rows={8} placeholder="Identify the records, approximate dates, incident or personnel identifiers, and any other detail that will help locate responsive records." /></label>
          <label>Preferred delivery<select name="preferred_delivery" defaultValue="Electronic"><option>Electronic</option><option>Inspection</option><option>Paper Copy</option></select></label>
        </div>
      </section>

      <section className="open-records-acknowledgement">
        <label>
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          <span><strong>I understand the release review requirements.</strong><small>I understand that some records or portions of records may be withheld or redacted under O.C.G.A. § 50-18-72, other applicable law, and the corresponding San Andreas RP provisions. I also understand that submitting a request does not guarantee disclosure of every requested item.</small></span>
        </label>
      </section>

      {error ? <p className="open-records-error" role="alert">{error}</p> : null}
      <div className="open-records-submit-row">
        <button className="button button--dark" type="submit" disabled={submitting || !acknowledged}>{submitting ? "Submitting…" : "Submit Open Records Request"}</button>
        <span>LSCSO will preserve the request and route it for records-custodian review.</span>
      </div>
    </form>
  );
}
