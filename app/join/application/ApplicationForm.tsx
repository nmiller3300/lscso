"use client";

import { FormEvent, useState } from "react";
import { APPLICATION_CERTIFICATION_TEXT } from "@/lib/recruitment/application";

type Question = {
  name: string;
  prompt: string;
  type: "text" | "number" | "textarea";
  hint?: string;
  placeholder?: string;
  compact?: boolean;
  scenario?: boolean;
};

type ApplicationSection = {
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  questions: readonly Question[];
};

const sections: readonly ApplicationSection[] = [
  {
    title: "Applicant Information",
    shortTitle: "Identity",
    eyebrow: "Candidate Record",
    description: "Start with the information Command will use to identify you and contact you during the selection process.",
    questions: [
      { name: "full_name", prompt: "What is your full name?", type: "text", placeholder: "First and last name", compact: true },
      { name: "discord_username", prompt: "What is your Discord username?", type: "text", placeholder: "Your Discord username", compact: true },
      { name: "age", prompt: "What is your age?", type: "number", placeholder: "Age", compact: true },
      { name: "timezone", prompt: "What is your timezone?", type: "text", placeholder: "Example: EST / America/New_York", compact: true },
    ],
  },
  {
    title: "Experience & Availability",
    shortTitle: "Experience",
    eyebrow: "Service Readiness",
    description: "Give Command a clear picture of your roleplay background, prior department experience, and realistic availability.",
    questions: [
      { name: "fivem_experience", prompt: "How long have you been playing FiveM and participating in serious roleplay?", type: "textarea", hint: "Tell us about the kind of communities, roles, and scenarios you have experience with.", placeholder: "Describe your FiveM and serious roleplay experience…" },
      { name: "previous_departments", prompt: "What departments or factions have you previously been a member of?", type: "textarea", hint: "Include the community, department, approximate rank, and why you left when relevant.", placeholder: "List prior departments or factions, or enter None…" },
      { name: "weekly_hours", prompt: "How many hours per week can you dedicate to LSCSO?", type: "text", placeholder: "Example: 8–12 hours", compact: true },
      { name: "upcoming_commitments", prompt: "Do you have any upcoming commitments that may affect your activity?", type: "textarea", hint: "School, work, travel, or other known commitments are fine — accuracy matters more than a perfect schedule.", placeholder: "Explain any upcoming commitments, or enter None…" },
    ],
  },
  {
    title: "Why LSCSO?",
    shortTitle: "Motivation",
    eyebrow: "Department Fit",
    description: "This is where we want to hear your reasoning, not a canned law-enforcement answer. Tell us why this department fits you.",
    questions: [
      { name: "why_lscso", prompt: "Why do you want to join the Los Santos County Sheriff's Office?", type: "textarea", hint: "Be specific about LSCSO, the type of roleplay you want, and what you hope to learn.", placeholder: "Tell Command why LSCSO is the department you want to serve with…" },
      { name: "contribution", prompt: "What do you believe you can contribute to LSCSO?", type: "textarea", hint: "Think beyond rank. Reliability, judgment, roleplay quality, teamwork, and initiative all matter.", placeholder: "Describe what you would bring to the department…" },
    ],
  },
  {
    title: "Background & Integrity",
    shortTitle: "Integrity",
    eyebrow: "Suitability Review",
    description: "Answer this section completely and honestly. Command uses it as part of the applicant suitability review.",
    questions: [
      { name: "drug_use_history", prompt: "Have you ever used illegal drugs, used prescription medication not prescribed to you, or otherwise misused a controlled substance? If yes, identify the substance(s), approximate date(s), frequency, and any relevant context. If no, enter No.", type: "textarea", hint: "Do not omit information because you think it will automatically disqualify you. Accuracy and integrity are being evaluated.", placeholder: "Provide a complete answer…" },
    ],
  },
  {
    title: "Roleplay & Law Enforcement",
    shortTitle: "LE Knowledge",
    eyebrow: "Foundational Judgment",
    description: "You do not need to write a textbook. We are looking for a working understanding of serious roleplay and basic law-enforcement decision making.",
    questions: [
      { name: "serious_roleplay_definition", prompt: "What does serious roleplay mean to you?", type: "textarea", hint: "Explain how you approach character decisions, consequences, realism, and collaborative scenes.", placeholder: "Describe your standard for serious roleplay…" },
      { name: "reasonable_suspicion_probable_cause", prompt: "Explain the difference between reasonable suspicion and probable cause.", type: "textarea", hint: "Use your own words. We are looking for your understanding, not copied legal language.", placeholder: "Explain the distinction and how each affects an officer's actions…" },
      { name: "use_of_force_factors", prompt: "What factors should an officer consider before using force?", type: "textarea", hint: "Think about threat, resistance, proportionality, available options, and the totality of the circumstances.", placeholder: "Walk through the factors you would evaluate…" },
    ],
  },
  {
    title: "Scenarios",
    shortTitle: "Scenarios",
    eyebrow: "Field Judgment",
    description: "Treat each prompt like a live roleplay situation. Explain what you would notice, what you would do, and why.",
    questions: [
      { name: "scenario_speeding_nervous", prompt: "You stop a vehicle for speeding. The driver becomes increasingly nervous during the stop. What do you do?", type: "textarea", hint: "Show how you balance officer safety, lawful authority, observation, and escalation decisions.", placeholder: "Talk Command through your actions from the stop forward…", scenario: true },
      { name: "scenario_deputy_policy_violation", prompt: "You witness another deputy violating department policy. What do you do?", type: "textarea", hint: "Consider immediate safety, professionalism, documentation, and the chain of command.", placeholder: "Explain how you would handle the violation…", scenario: true },
      { name: "scenario_supervisor_order", prompt: "A supervisor orders you to do something you believe violates department policy. How do you handle it?", type: "textarea", hint: "Explain how you would clarify the order, protect the scene, and address the policy concern appropriately.", placeholder: "Explain your decision-making and communication…", scenario: true },
    ],
  },
] as const;

const totalSteps = sections.length + 1;

export function ApplicationForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const signed = Boolean(signatureName && signedAt);
  const currentSection = step < sections.length ? sections[step] : null;
  const questionOffset = sections.slice(0, step).reduce((total, section) => total + section.questions.length, 0);

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

    if (!currentSection) return false;
    for (const question of currentSection.questions) {
      const value = values[question.name]?.trim() ?? "";
      if (!value) {
        setError("Please answer every question in this section before continuing.");
        return false;
      }
      if (question.name === "age") {
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
    window.scrollTo({ top: Math.max(0, document.querySelector(".application-workspace")?.getBoundingClientRect().top ?? 0) + window.scrollY - 96, behavior: "smooth" });
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: Math.max(0, document.querySelector(".application-workspace")?.getBoundingClientRect().top ?? 0) + window.scrollY - 96, behavior: "smooth" });
  }

  function goBackTo(index: number) {
    if (index >= step) return;
    setError("");
    setStep(index);
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validateCurrentStep()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/applications", {
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The application could not be submitted.");
      setApplicationNumber(String(data.application_number));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The application could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (applicationNumber) {
    return (
      <section className="application-success">
        <div className="application-success__seal"><img src="/images/lscso-portal-patch.webp" alt="Los Santos County Sheriff's Office patch" /></div>
        <p className="application-success__eyebrow">Application transmitted</p>
        <h2>Your candidate packet is in Command&apos;s queue.</h2>
        <p className="application-success__lead">Your signed application was received successfully and assigned a permanent application number.</p>
        <strong className="application-success__number">APP-{applicationNumber.padStart(4, "0")}</strong>
        <div className="application-success__timeline" aria-label="Recruitment process">
          <article className="is-active"><span>01</span><div><strong>Command Review</strong><small>Your application is screened by Captain+ staff.</small></div></article>
          <article><span>02</span><div><strong>Application Decision</strong><small>If accepted, the application advances to interview.</small></div></article>
          <article><span>03</span><div><strong>Interview</strong><small>Recruitment staff will contact you on Discord to schedule it.</small></div></article>
          <article><span>04</span><div><strong>Recruit Onboarding</strong><small>A passed interview clears you for the hiring handoff.</small></div></article>
        </div>
        <div className="application-success__notice"><strong>What happens next?</strong><p>If Command accepts your application, LSCSO staff will contact you through Discord to arrange your interview. Application acceptance is not the same as being hired. If the application is denied, no interview is scheduled.</p></div>
        <p className="application-success__keep">Keep <b>APP-{applicationNumber.padStart(4, "0")}</b> for your records.</p>
      </section>
    );
  }

  return (
    <div className="application-workspace">
      <aside className="application-briefing" aria-label="Application briefing">
        <div className="application-briefing__identity">
          <img src="/images/lscso-portal-patch.webp" alt="" aria-hidden="true" />
          <div><span>LSCSO Recruitment</span><strong>Deputy Candidate Packet</strong></div>
        </div>
        <div className="application-briefing__current">
          <span>Current section</span>
          <strong>{currentSection?.title ?? "Applicant Certification"}</strong>
          <p>{currentSection?.description ?? "Review your certification, apply your electronic signature, and transmit the completed packet to Command."}</p>
        </div>
        <ol className="application-briefing__steps">
          {sections.map((section, index) => (
            <li key={section.title} className={index === step ? "is-current" : index < step ? "is-complete" : ""}>
              <button type="button" onClick={() => goBackTo(index)} disabled={index >= step}>
                <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{section.shortTitle}</strong><small>{index < step ? "Completed" : index === step ? "In progress" : "Pending"}</small></div>
              </button>
            </li>
          ))}
          <li className={step === sections.length ? "is-current" : ""}><button type="button" disabled><span>{String(totalSteps).padStart(2, "0")}</span><div><strong>Certification</strong><small>{step === sections.length ? "In progress" : "Pending"}</small></div></button></li>
        </ol>
        <div className="application-briefing__note">
          <span>Command is evaluating</span>
          <p>Integrity, judgment, communication, maturity, roleplay quality, and whether your answers show that you can operate within a chain of command.</p>
        </div>
      </aside>

      <form className="application-form" onSubmit={submit}>
        <div className="application-progress" aria-label={`Application section ${step + 1} of ${totalSteps}`}>
          <div className="application-progress__top"><div><span>Candidate Packet Progress</span><strong>{step < sections.length ? sections[step].title : "Applicant Certification"}</strong></div><b>{step + 1} / {totalSteps}</b></div>
          <div className="application-progress__bar"><span style={{ width: `${((step + 1) / totalSteps) * 100}%` }} /></div>
        </div>

        {step < sections.length && currentSection ? (
          <fieldset className="application-section">
            <legend className="sr-only">{currentSection.title}</legend>
            <header className="application-section__header">
              <div className="application-section__number">{String(step + 1).padStart(2, "0")}</div>
              <div><p>{currentSection.eyebrow}</p><h2>{currentSection.title}</h2><span>{currentSection.description}</span></div>
            </header>

            <div className={`application-question-grid ${currentSection.questions.every((question) => question.compact) ? "application-question-grid--compact" : ""}`}>
              {currentSection.questions.map((question, questionIndex) => {
                const value = values[question.name] || "";
                return (
                  <div className={`application-question ${question.compact ? "application-question--compact" : ""} ${question.scenario ? "application-question--scenario" : ""}`} key={question.name}>
                    <div className="application-question__heading">
                      <span className="application-question__number">{String(questionOffset + questionIndex + 1).padStart(2, "0")}</span>
                      <div>{question.scenario ? <b>Field Scenario</b> : null}<label htmlFor={question.name}>{question.prompt}</label>{question.hint ? <small>{question.hint}</small> : null}</div>
                    </div>
                    {question.type === "textarea" ? (
                      <><textarea id={question.name} required rows={6} maxLength={8000} placeholder={question.placeholder} value={value} onChange={(event) => setValue(question.name, event.target.value)} /><span className="application-question__count">{value.length.toLocaleString()} / 8,000</span></>
                    ) : (
                      <input id={question.name} required type={question.type} min={question.type === "number" ? 13 : undefined} max={question.type === "number" ? 100 : undefined} placeholder={question.placeholder} value={value} onChange={(event) => setValue(question.name, event.target.value)} />
                    )}
                  </div>
                );
              })}
            </div>

            {currentSection.title === "Background & Integrity" ? (
              <div className="application-screening-notice" role="note">
                <div className="application-screening-notice__icon" aria-hidden="true">!</div>
                <div><span>Applicant Screening Notice</span><strong>Additional suitability screening applies to advancing candidates.</strong><p>Candidates who advance in the selection process are subject to fingerprinting, blood testing, drug testing, and breathalyzer testing as part of LSCSO background and suitability screening.</p></div>
              </div>
            ) : null}

            {error ? <p className="application-error" role="alert">{error}</p> : null}
            <div className="application-navigation">
              {step > 0 ? <button className="button application-navigation__back" type="button" onClick={previousStep}>← Previous Section</button> : <span />}
              <div><small>Section {step + 1} of {totalSteps}</small><button className="button button--dark application-navigation__next" type="button" onClick={nextStep}>Continue <span aria-hidden="true">→</span></button></div>
            </div>
          </fieldset>
        ) : (
          <section className="application-certification" aria-labelledby="application-certification-title">
            <header className="application-section__header application-certification__header">
              <div className="application-section__number">{String(totalSteps).padStart(2, "0")}</div>
              <div><p>Final Candidate Certification</p><h2 id="application-certification-title">Review, certify, and sign.</h2><span>Your electronic signature is retained with the submitted application as part of the permanent recruitment record.</span></div>
            </header>

            <div className="application-screening-notice application-screening-notice--final" role="note">
              <div className="application-screening-notice__icon" aria-hidden="true">✓</div>
              <div><span>Applicant Screening Notice</span><strong>Fingerprinting and testing requirements</strong><p>LSCSO candidates are subject to fingerprinting, blood testing, drug testing, and breathalyzer testing as part of the department&apos;s background and suitability screening process.</p></div>
            </div>

            <div className="application-certification__statement"><span>Certification statement</span><p>{APPLICATION_CERTIFICATION_TEXT}</p></div>

            <div className={`application-signature ${signed ? "is-signed" : ""}`}>
              <div className="application-signature__status"><span>Electronic Signature</span>{signed ? <><strong className="application-signature__script">{signatureName}</strong><small>Signed {new Date(signedAt!).toLocaleString()}</small></> : <><strong>Signature required</strong><small>Your full name from Section 01 will be used as your electronic signature.</small></>}</div>
              {signed ? <button className="application-signature__clear" type="button" onClick={clearSignature}>Clear signature</button> : <button className="application-signature__button" type="button" onClick={signApplication}>Apply Electronic Signature</button>}
            </div>

            <p className="application-certification__notice">By applying your signature, you acknowledge the certification and applicant-screening notice above and authorize LSCSO to retain the signature with your application.</p>
            {error ? <p className="application-error" role="alert">{error}</p> : null}
            <div className="application-navigation">
              <button className="button application-navigation__back" type="button" onClick={previousStep}>← Previous Section</button>
              <div><small>Final transmission</small><button className="button button--dark application-navigation__submit" type="submit" disabled={submitting || !signed}>{submitting ? "Transmitting Application…" : "Submit to LSCSO Command"}</button></div>
            </div>
          </section>
        )}
      </form>
    </div>
  );
}
