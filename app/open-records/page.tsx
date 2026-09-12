import type { Metadata } from "next";
import { PageHero } from "../_components/PageHero";
import { OpenRecordsRequestForm } from "./OpenRecordsRequestForm";
import "./open-records.css";

export const metadata: Metadata = {
  title: "Open Records Request",
  description: "Submit a public records request to the Los Santos County Sheriff's Office.",
};

export default function OpenRecordsPage() {
  return (
    <>
      <PageHero
        eyebrow="Public Records"
        title="Open Records Request"
        description="Request existing LSCSO records for inspection or copying through the department's public records process."
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
            <p className="intro-serif">LSCSO uses Georgia's Open Records Act as the real-world legal model and a parallel San Andreas roleplay statute for in-universe documentation.</p>
            <p>Requests should identify existing records as specifically as possible. Some information may be withheld or redacted when a statute, court order, privacy protection, investigative exemption, or other confidentiality rule applies.</p>
            <p>The three-business-day rule does not mean every complex request must be fully produced within three days. When responsive records require additional review, the custodian may provide a timely description and production estimate while continuing the review.</p>
          </div>
        </div>
      </section>

      <section className="content-section open-records-workspace">
        <div className="site-shell">
          <OpenRecordsRequestForm />
        </div>
      </section>
    </>
  );
}
