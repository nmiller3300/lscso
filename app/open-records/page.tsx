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
        description="Request existing LSCSO records, track the request privately, and receive approved records through a secure release link."
        image="/images/lscso-patch-subdued.png"
        imageAlt="Subdued LSCSO shoulder patch"
        containedImage
      />

      <section className="content-section content-section--light open-records-intro">
        <div className="site-shell open-records-intro__layout">
          <div className="open-records-intro__copy">
            <p className="section-kicker section-kicker--dark">Public Access</p>
            <h2>Request. Track. Receive.</h2>
            <p>
              Submit a focused request for records maintained by the Sheriff&apos;s Office. A Records Custodian reviews the request, sets any applicable fee, and determines what may lawfully be released.
            </p>
            <a className="route-link route-link--gold open-records-law-link" href={OPEN_RECORDS_ACT_URL} target="_blank" rel="noreferrer">
              <span>View Open Records Act</span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="open-records-process" aria-label="Open Records process summary">
            <article>
              <span>01</span>
              <div><strong>Submit the request</strong><p>Tell us what existing records you are looking for and include your Discord username.</p></div>
            </article>
            <article>
              <span>02</span>
              <div><strong>Review and payment</strong><p>A First Lieutenant or above reviews the request. If a fee is assessed, it must be paid in city before processing continues.</p></div>
            </article>
            <article>
              <span>03</span>
              <div><strong>Private electronic release</strong><p>Approved files are delivered through your private tracking page and remain available for 48 hours.</p></div>
            </article>
          </div>
        </div>
      </section>

      <section className="content-section open-records-workspace">
        <div className="site-shell">
          <div className="open-records-workspace-heading">
            <div>
              <p className="section-kicker">Request Form</p>
              <h2>Tell us what you need.</h2>
            </div>
            <p>Submit once. You will receive a private tracking link immediately and can follow the request from review through release.</p>
          </div>
          <OpenRecordsRequestWorkflowForm />
        </div>
      </section>
    </>
  );
}
