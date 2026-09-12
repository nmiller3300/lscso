import type { Metadata } from "next";
import { PageHero } from "../_components/PageHero";
import { OpenRecordsRequestWorkflowForm } from "./OpenRecordsRequestWorkflowForm";
import "./open-records.css";

export const metadata: Metadata = {
  title: "Open Records Request",
  description: "Submit and privately track an Open Records Request to the Los Santos County Sheriff's Office.",
};

const OPEN_RECORDS_ACT_URL = "https://lscso-gov.notion.site/San-Andreas-Open-Records-Act-OCSA-50-18-70-Series-3d9305c9558581be90f9e0059e76d13c";

export default function OpenRecordsPage() {
  return (
    <>
      <PageHero
        eyebrow="Public Records"
        title="Open Records Request"
        description="Request existing LSCSO records, track the request privately, pay any assessed in-city fee, and receive approved files electronically."
        image="/images/lscso-patch-subdued.png"
        imageAlt="Subdued LSCSO shoulder patch"
        containedImage
      />

      <section className="content-section content-section--light open-records-intro">
        <div className="site-shell open-records-intro__layout">
          <div className="open-records-intro__copy">
            <p className="section-kicker section-kicker--dark">Public Access</p>
            <h2>Request records from LSCSO.</h2>
            <p>Submit a request for existing records maintained by the Sheriff&apos;s Office. A First Lieutenant or above reviews the request, determines any applicable fee, and decides what records may lawfully be released.</p>
            <a className="button button--dark open-records-law-link" href={OPEN_RECORDS_ACT_URL} target="_blank" rel="noreferrer">
              View Open Records Act
            </a>
          </div>

          <div className="open-records-summary" aria-label="Open Records process summary">
            <article>
              <strong>72 Hours</strong>
              <span>Initial acknowledgement and determination.</span>
            </article>
            <article>
              <strong>In-City Payment</strong>
              <span>If a fee is assessed, payment is required before processing continues.</span>
            </article>
            <article>
              <strong>48-Hour Release</strong>
              <span>Approved download files remain available for 48 hours after release.</span>
            </article>
          </div>
        </div>
      </section>

      <section className="content-section open-records-workspace">
        <div className="site-shell">
          <OpenRecordsRequestWorkflowForm />
        </div>
      </section>
    </>
  );
}
