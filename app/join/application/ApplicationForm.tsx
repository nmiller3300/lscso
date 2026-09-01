"use client";

import { FormEvent, useState } from "react";
import { APPLICATION_CERTIFICATION_TEXT } from "@/lib/recruitment/application";

type Question = readonly [string, string, "text" | "number" | "textarea"];
type ApplicationSection = readonly [string, readonly Question[]];

const sections: readonly ApplicationSection[] = [
  ["Applicant Information", [["full_name","What is your full name?","text"],["discord_username","What is your Discord username?","text"],["age","What is your age?","number"],["timezone","What is your timezone?","text"]]],
  ["Experience & Availability", [["fivem_experience","How long have you been playing FiveM and participating in serious roleplay?","textarea"],["previous_departments","What departments or factions have you previously been a member of?","textarea"],["weekly_hours","How many hours per week can you dedicate to LSCSO?","text"],["upcoming_commitments","Do you have any upcoming commitments that may affect your activity?","textarea"]]],
  ["Why LSCSO?", [["why_lscso","Why do you want to join the Los Santos County Sheriff's Office?","textarea"],["contribution","What do you believe you can contribute to LSCSO?","textarea"]]],
  ["Roleplay & Law Enforcement", [["serious_roleplay_definition","What does serious roleplay mean to you?","textarea"],["reasonable_suspicion_probable_cause","Explain the difference between reasonable suspicion and probable cause.","textarea"],["use_of_force_factors","What factors should an officer consider before using force?","textarea"]]],
  ["Scenarios", [["scenario_speeding_nervous","You stop a vehicle for speeding. The driver becomes increasingly nervous during the stop. What do you do?","textarea"],["scenario_deputy_policy_violation","You witness another deputy violating department policy. What do you do?","textarea"],["scenario_supervisor_order","A supervisor orders you to do something you believe violates department policy. How do you handle it?","textarea"]]],
] as const;

const totalSteps = sections.length + 1;

export function ApplicationForm() {
  const [values, setValues] = useState<Record<string,string>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const signed = Boolean(signatureName && signedAt);
  const currentSection = sections[step];
  const questionOffset = sections.slice(0, step).reduce((total, [, questions]) => total + questions.length, 0);

  const setValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    if (name === "full_name" && signed) {
      setSignatureName("");
      setSignedAt(null);
    }
  };

  function validateCurrentStep() {
    setError("");
    if (step === sections.length) {
      if (!signed) {
        setError("You must electronically sign the application before submitting it.");
        return false;
      }
      return true;
    }

    for (const [name] of currentSection[1]) {
      const value = values[name]?.trim() ?? "";
      if (!value) {
        setError("Please answer every question in this section before continuing.");
        return false;
      }
      if (name === "age") {
        const age = Number(value);
        if (!Number.isInteger(age) || age < 13 || age > 100) {
          setError("Please enter a valid age between 13 and 100.");
          return false;
        }
      }
    }
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function signApplication() {
    const name = values.full_name?.trim();
    setError("");
    if (!name || name.length < 2) {
      setError("Return to Applicant Information and enter your full name before signing.");
      return;
    }
    setSignatureName(name);
    setSignedAt(new Date().toISOString());
  }

  function clearSignature() {
    setSignatureName("");
    setSignedAt(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!validateCurrentStep()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          mandatory_training: "Yes",
          prior_discipline: "No",
          prior_discipline_explanation: "",
          applicant_certification: true,
          signature_confirmed: true,
          applicant_signature_name: signatureName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The application could not be submitted.");
      setApplicationNumber(String(data.application_number));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The application could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (applicationNumber) {
    return <section className="application-success"><p className="section-kicker section-kicker--dark">Application Received</p><h2>Thank you for applying.</h2><p>Your signed application has been submitted successfully as one complete personnel recruitment record for LSCSO Command review.</p><strong>Application Number: APP-{applicationNumber.padStart(4,"0")}</strong><p>Keep this number for your records.</p></section>;
  }

  return <form className="application-form" onSubmit={submit}>
    <div className="application-progress" aria-label={`Application section ${step + 1} of ${totalSteps}`}>
      <div className="application-progress__top"><strong>{step < sections.length ? currentSection[0] : "Applicant Certification"}</strong><span>Section {step + 1} of {totalSteps}</span></div>
      <div className="application-progress__bar"><span style={{ width: `${((step + 1) / totalSteps) * 100}%` }} /></div>
      <div className="application-progress__steps">
        {sections.map(([title], index) => <button type="button" key={title} className={index === step ? "is-current" : index < step ? "is-complete" : ""} onClick={() => { if (index < step) { setError(""); setStep(index); } }} disabled={index >= step}>{String(index + 1).padStart(2,"0")} <span>{title}</span></button>)}
        <button type="button" className={step === sections.length ? "is-current" : ""} disabled>{String(totalSteps).padStart(2,"0")} <span>Certification</span></button>
      </div>
    </div>

    {step < sections.length ? <fieldset className="application-section">
      <legend><span>{String(step + 1).padStart(2,"0")}</span>{currentSection[0]}</legend>
      {currentSection[1].map(([name, question, type], questionIndex) => <div className="application-question" key={name}>
        <label htmlFor={name}><strong>{questionOffset + questionIndex + 1}.</strong> {question}</label>
        {type === "textarea" ? <textarea id={name} required rows={5} value={values[name] || ""} onChange={(e) => setValue(name,e.target.value)} /> : <input id={name} required type={type} min={type === "number" ? 13 : undefined} max={type === "number" ? 100 : undefined} value={values[name] || ""} onChange={(e) => setValue(name,e.target.value)} />}
      </div>)}
      <div className="application-navigation">
        {step > 0 ? <button className="button application-navigation__back" type="button" onClick={previousStep}>Back</button> : <span />}
        <button className="button button--dark" type="button" onClick={nextStep}>Next Section <span aria-hidden="true">→</span></button>
      </div>
    </fieldset> : <section className="application-certification" aria-labelledby="application-certification-title">
      <p className="application-certification__eyebrow">Final Section</p>
      <h2 id="application-certification-title">Applicant Certification</h2>
      <p className="application-certification__statement">{APPLICATION_CERTIFICATION_TEXT}</p>
      <div className={`application-signature ${signed ? "is-signed" : ""}`}>
        <div>
          <span>Applicant signature</span>
          {signed ? <><strong>{signatureName}</strong><small>Electronically signed {new Date(signedAt!).toLocaleString()}</small></> : <><strong>Not yet signed</strong><small>Your full name from Section 01 will be used as your electronic signature.</small></>}
        </div>
        {signed ? <button className="application-signature__clear" type="button" onClick={clearSignature}>Clear signature</button> : <button className="application-signature__button" type="button" onClick={signApplication}>Click to Sign Application</button>}
      </div>
      <p className="application-certification__notice">By clicking to sign, you acknowledge the certification above and authorize LSCSO to retain this electronic signature with your application.</p>
      {error && <p className="application-error" role="alert">{error}</p>}
      <div className="application-navigation">
        <button className="button application-navigation__back" type="button" onClick={previousStep}>Back</button>
        <button className="button button--dark" type="submit" disabled={submitting || !signed}>{submitting ? "Submitting Application…" : "Submit Signed Application"}</button>
      </div>
    </section>}
    {step < sections.length && error && <p className="application-error" role="alert">{error}</p>}
  </form>;
}
