import type { Metadata } from "next";
import { PageHero } from "../_components/PageHero";
import { OpenRecordsRequestWorkflowForm } from "./OpenRecordsRequestWorkflowForm";
import "./open-records.css";

export const metadata: Metadata = {
  title: "Open Records Request",
  description: "Submit and privately track a public records request to the Los Santos County Sheriff's Office.",
};

export default function OpenRecordsPage() {
  return (
    <>
      <PageHero
        eyebrow="Public Records"
        title="Open Records Request"
        description="Request existing LSCSO records, track the request privately, pay any assessed in-city fee, and receive approved release files electronically."
        image="/images/lscso-patch-subdued.png"
        imageAlt="Subdued LSCSO shoulder patch"
        containedImage
      />

      <section className="content-section content-section--light open-records-intro">
        <div className="site-shell two-column-editorial">
          <div>
            <p className="section-kicker section-kicker--dark">Public Access</p>
            <h2>Ask for records. We review what the law permits us to release.</h2>
          </div>
          <div className="reading-column">
            <p className="intro-serif">LSCSO uses the Georgia Open Records Act as its real-world legal model and OCSA § 50-18-70 et seq. as the State of San Andreas government-transparency statute.</p>
            <p>Under OCSA, a First Lieutenant or above serves as the Records Custodian. LSCSO must acknowledge and make its initial determination within 72 hours, while complex collection, payment, redaction, or legal review may require additional production time.</p>
            <p>Not every requested record is automatically releasable. Protected portions may be redacted or withheld under applicable law, and a partial grant or denial must identify the legal basis used.</p>
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
