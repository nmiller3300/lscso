"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  GEORGIA_EXEMPTION_RULE,
  GEORGIA_OPEN_RECORDS_CITATION,
  GEORGIA_OPEN_RECORDS_QUOTE,
  GEORGIA_RESPONSE_RULE,
  SAN_ANDREAS_CUSTODIAN_RULE,
  SAN_ANDREAS_EXEMPTION_RULE,
  SAN_ANDREAS_OPEN_RECORDS_CITATION,
  SAN_ANDREAS_OPEN_RECORDS_QUOTE,
  SAN_ANDREAS_PAYMENT_RULE,
  SAN_ANDREAS_RELEASE_RULE,
  SAN_ANDREAS_RESPONSE_RULE,
} from "@/lib/open-records/legal";

type SubmitResult = { request_number: number | string; tracking_token: string };

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function OpenRecordsRequestWorkflowForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [trackingCopied, setTrackingCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!acknowledged) {
      setError("Please acknowledge the Open Records process before submitting.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const discord = value(form, "discord_username");
    if (discord.length < 2) {
      setError("Your Discord username is required.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient() as any;
      const { data, error: submitError } = await supabase.rpc("submit_open_records_request", {
        p_first_name: value(form, "first_name"),
        p_last_name: value(form, "last_name"),
        p_email: value(form, "email"),
        p_discord_username: discord,
        p_phone: value(form, "phone"),
        p_organization: value(form, "organization"),
        p_subject_name: value(form, "subject_name"),
        p_subject_personnel_id: value(form, "subject_personnel_id"),
        p_records_description: value(form, "records_description"),
        p_preferred_delivery: "Electronic",
        p_legal_acknowledgement: true,
      }).single();

      if (submitError || !data) throw new Error(submitError?.message || "The request could not be submitted.");
      setResult({ request_number: data.request_number, tracking_token: String(data.tracking_token) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyTrackingLink() {
    if (!result?.tracking_token) return;
    const href = `${window.location.origin}/open-records/status/${encodeURIComponent(result.tracking_token)}`;
    try {
      await navigator.clipboard.writeText(href);
      setTrackingCopied(true);
      window.setTimeout(() => setTrackingCopied(false), 1600);
    } catch {
      setTrackingCopied(false);
    }
  }

  if (result) {
    const trackingHref = `/open-records/status/${encodeURIComponent(result.tracking_token)}`;
    return (
      <section className="open-records-success" aria-live="polite">
        <p className="section-kicker section-kicker--dark">Request Received</p>
        <h2>Your Open Records Request is active.</h2>
        <strong>ORR-{String(result.request_number).padStart(5, "0")}</strong>
        <p>Your private tracking page is the official place to see the 72-hour response deadline, assessed fee, in-city payment status, release decision, and any records LSCSO makes available.</p>
        <div className="page-actions">
          <a className="button button--dark" href={trackingHref}>Open My Request</a>
          <button className="button button--outline" type="button" onClick={() => void copyTrackingLink()}>{trackingCopied ? "Tracking Link Copied" : "Copy Private Tracking Link"}</button>
        </div>
        <div className="open-records-success__notice">
          <strong>Save this private link.</strong>
          <p>Anyone with the link can view the requester-facing status and released files during the active release window. Do not post it publicly. Release files expire 48 hours after LSCSO publishes them.</p>
        </div>
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
          <span>State of San Andreas · OCSA</span>
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
          <label>Discord username<input name="discord_username" required maxLength={100} placeholder="Required" /></label>
          <label>Phone <span>(optional)</span><input type="tel" name="phone" maxLength={50} /></label>
          <label>Organization / agency <span>(optional)</span><input name="organization" maxLength={160} /></label>
        </div>
      </section>

      <section className="open-records-form-card">
        <div className="open-records-form-heading">
          <p className="section-kicker section-kicker--dark">Records Requested</p>
          <h2>Describe the existing records you want.</h2>
          <p>Be as specific as possible. LSCSO will review the responsive material and release only what applicable law requires or permits after any required redaction.</p>
        </div>
        <div className="open-records-fields open-records-fields--two">
          <label>Personnel member / subject <span>(optional)</span><input name="subject_name" maxLength={160} placeholder="Name of deputy or other subject" /></label>
          <label>Personnel ID <span>(optional)</span><input name="subject_personnel_id" maxLength={40} placeholder="LS-000" /></label>
          <label className="open-records-field-wide">Records description<textarea name="records_description" required minLength={10} maxLength={8000} rows={8} placeholder="Identify the records, approximate dates, incident or personnel identifiers, and any other detail that will help locate responsive records." /></label>
        </div>
      </section>

      <section className="open-records-form-card open-records-process-card">
        <div className="open-records-form-heading"><p className="section-kicker section-kicker--dark">How Processing Works</p><h2>Review, fee, payment, then release.</h2></div>
        <div className="open-records-process-grid">
          <article><span>01</span><strong>Custodian Review</strong><p>{SAN_ANDREAS_CUSTODIAN_RULE}</p></article>
          <article><span>02</span><strong>Fee & Payment</strong><p>{SAN_ANDREAS_PAYMENT_RULE}</p></article>
          <article><span>03</span><strong>Records Review</strong><p>LSCSO gathers responsive records, applies lawful redactions or withholding, and records the legal basis for any partial grant or denial.</p></article>
          <article><span>04</span><strong>Private Release</strong><p>{SAN_ANDREAS_RELEASE_RULE}</p></article>
        </div>
      </section>

      <section className="open-records-acknowledgement">
        <label>
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          <span><strong>I understand the Open Records process.</strong><small>I understand that a fee may be assessed and must be paid in city before processing continues, that not every requested record is legally releasable, and that released files are available through the private tracking link for 48 hours before temporary release copies expire and are purged.</small></span>
        </label>
      </section>

      {error ? <p className="open-records-error" role="alert">{error}</p> : null}
      <div className="open-records-submit-row">
        <button className="button button--dark" type="submit" disabled={submitting || !acknowledged}>{submitting ? "Submitting…" : "Submit Open Records Request"}</button>
        <span>A private tracking link is created immediately after successful submission.</span>
      </div>
    </form>
  );
}
