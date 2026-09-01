import type { Metadata } from "next";
import { PageHero } from "../_components/PageHero";
import { PolicyDirectory } from "./PolicyDirectory";
import { POLICY_DOCU_GUIDE_URL, POLICY_REGISTER_SOURCE, policyRegister } from "@/lib/policies/policy-register";
import styles from "./policies.module.css";

export const metadata: Metadata = {
  title: "Policy Directory | Los Santos County Sheriff’s Office",
  description: "Search current adopted LSCSO policies and open the controlling directives maintained in the LSCSO Policy Docu-Guide.",
};

export default function PoliciesPage() {
  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="Department Policy"
        title="Policy Directory"
        description="Current adopted LSCSO directives, organized for direct public access to the controlling policy record."
        image="/images/command-uniform.png"
        imageAlt="LSCSO command staff member"
        imagePosition="center 28%"
      />

      <section className={styles.intro}>
        <div className={`site-shell ${styles.introGrid}`}>
          <div>
            <h2>One directory. The controlling document stays in Notion.</h2>
            <p>
              This directory reflects the adopted policy register maintained by LSCSO. The website does not reproduce or replace policy language. Selecting a policy opens the current controlling directive through its registered Notion Policy Link.
            </p>
          </div>
          <aside className={styles.sourceCard}>
            <small>Authoritative source</small>
            <strong>{POLICY_REGISTER_SOURCE}</strong>
            <span>{policyRegister.length} current Final directives are indexed from the department Policy Document Register.</span>
            <a href={POLICY_DOCU_GUIDE_URL} target="_blank" rel="noreferrer">Open Policy Docu-Guide ↗</a>
          </aside>
        </div>
      </section>

      <section className={styles.directorySection}>
        <div className="site-shell">
          <PolicyDirectory policies={policyRegister} />
        </div>
      </section>
    </div>
  );
}
