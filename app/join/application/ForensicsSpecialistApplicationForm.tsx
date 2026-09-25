"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import {
  APPLICATION_AI_ACKNOWLEDGEMENT_TEXT,
  APPLICATION_AI_POLICY_TEXT,
  APPLICATION_CERTIFICATION_TEXT,
  type RecruitmentApplicationQuestion,
} from "@/lib/recruitment/application";

type Section = {
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  questions: RecruitmentApplicationQuestion[];
};

export function ForensicsSpecialistApplicationForm({ questions }: { questions: RecruitmentApplicationQuestion[] }) {
  const sections = useMemo<Section[]>(() => {
    const result: Section[] = [];
    for (const question of [...questions].filter((item) => item.active).sort((a, b) => a.sortOrder - b.sortOrder)) {
      let section = result.find((item) => item.title === question.sectionTitle);
      if (!section) {
        section = {
          title: question.sectionTitle,
          shortTitle: question.sectionShortTitle || question.sectionTitle,
          eyebrow: question.sectionEyebrow || "Forensic Services",
          description: question.sectionDescription || "Complete each question carefully and answer in your own words.",
          questions: [],
        };
        result.push(section);
      }
      section.questions.push(question);
    }
    return result;
  }, [questions]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [trackingCopied, setTrackingCopied] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [aiPolicyAccepted, setAiPolicyAccepted] = useState(false);
  const [aiGatePassed, setAiGatePassed] = useState(false);

  const totalSteps = sections.length + 1;
  const currentSection = step < sections.length ? sections[step] : null;
  const signed = Boolean(signatureName && signedAt);
  const fullNameQuestion = questions.find((question) => question.systemField === "full_name");
  const fullName = fullNameQuestion ? values[fullNameQuestion.questionKey]?.trim() ?? "" : "";
  const questionOffset = sections.slice(0, step).reduce((total, section) => total + section.questions.length, 0);

  function setValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    if (name === fullNameQuestion?.questionKey && signed) {
      setSignatureName("");
      setSignedAt(null);
    }
  }

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
      const value = values[question.questionKey]?.trim() ?? "";
      if (question.required && !value) {
        setError("Please answer every required question in this section before continuing.");
        return false;
      }
      if (value.length > 8000) {
        setError("Application answers cannot exceed 8,000 characters.");
        return false;
      }
      if (question.systemField === "age" && value) {
        const age = Number(value);
        if (!Number.isInteger(age) || age < 13 || age > 100) {
          setError("Please enter a valid age between 13 and 100.");
          return false;
        }
      }
    }
    return true;
  }

  function scrollToWorkspace() {
    const top = document.querySelector(".application-workspace")?.getBoundingClientRect().top ?? 0;
    window.scrollTo({ top: Math.max(0, top + window.scrollY - 96), behavior: "smooth" });
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, totalSteps - 1));
    scrollToWorkspace();
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
    scrollToWorkspace();
  }

  function goBackTo(index: number) {
    if (index >= step) return;
    setError("");
    setStep(index);
    scrollToWorkspace();
  }

  function signApplication() {
    setError("");
    if (!fullName || fullName.length < 2) {
      setError("Return to Applicant Information and enter your full name before signing.");
      return;
    }
    setSignatureName(fullName);
    setSignedAt(new Date().toISOString());
  }

  async function copyTrackingLink() {
    if (!trackingToken) return;
    const trackingUrl = `${window.location.origin}/join/application/status/${encodeURIComponent(trackingToken)}`;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setTrackingCopied(true);
    } catch {
      setTrackingCopied(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!aiGatePassed || !aiPolicyAccepted) {
      setError("You must acknowledge the LSCSO AI Use Policy before submitting the application.");
      return;
    }
    if (!validateCurrentStep()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_track: "Forensics Specialist",
          answers: values,
          applicant_certification: true,
          signature_confirmed: true,
          applicant_signature_name: signatureName,
          ai_policy_acknowledged: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The application could not be submitted.");
      setApplicationNumber(String(data.application_number));
      setTrackingToken(typeof data.tracking_token === "string" ? data.tracking_token : null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The application could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (applicationNumber) {
    const trackingHref = trackingToken ? `/join/application/status/${encodeURIComponent(trackingToken)}` : null;
    return (
      <section className="application-success">
        <div className="application-success__seal"><Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={160} height={160} /></div>
        <p className="application-success__eyebrow">Forensics application transmitted</p>
        <h2>Your Forensic Services candidate packet is in Command&apos;s queue.</h2>
        <p className="application-success__lead">Your signed application was received successfully and assigned a permanent application number.</p>
        <strong className="application-success__number">APP-{applicationNumber.padStart(4, "0")}</strong>
        <div className="application-success__timeline" aria-label="Forensics Specialist selection process">
          <article className="is-active"><span>01</span><div><strong>Command Review</strong><small>Authorized Command staff review the complete candidate record.</small></div></article>
          <article><span>02</span><div><strong>Application Decision</strong><small>Accepted applications advance to the required specialist interview.</small></div></article>
          <article><span>03</span><div><strong>Interview</strong><small>Command evaluates technical judgment, evidence integrity, and department fit.</small></div></article>
          <article><span>04</span><div><strong>Appointment</strong><small>A passed interview may advance to a separate Forensics Specialist personnel appointment.</small></div></article>
          <article><span>05</span><div><strong>Portal Onboarding</strong><small>After appointment, the member enters the standard LSCSO personnel portal under Forensic Services.</small></div></article>
        </div>
        <div className="application-success__notice"><strong>Private applicant status page</strong><p>Save your private tracking link. Anyone with the link can view the candidate-facing status, so do not post it publicly.</p></div>
        {trackingHref ? <div className="button-row"><a className="button button--dark" href={trackingHref}>Track My Application</a><button className="button button--outline" type="button" onClick={() => void copyTrackingLink()}>{trackingCopied ? "Tracking Link Copied" : "Copy Private Tracking Link"}</button></div> : null}
        <p className="application-success__keep">Keep <b>APP-{applicationNumber.padStart(4, "0")}</b> and your private tracking link for your records.</p>
      </section>
    );
  }

  if (!aiGatePassed) {
    return (
      <section className="application-ai-gate" aria-labelledby="forensics-ai-policy-title">
        <header className="application-ai-gate__header">
          <div className="application-ai-gate__seal"><Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={132} height={132} priority /></div>
          <div><p>Mandatory Applicant Integrity Notice</p><h2 id="forensics-ai-policy-title">AI assistance is prohibited.</h2><span>You must read and accept this policy before the Forensics Specialist application will open.</span></div>
        </header>
        <div className="application-ai-gate__warning"><strong>Any detected use of AI will result in immediate denial.</strong><p>{APPLICATION_AI_POLICY_TEXT}</p></div>
        <div className="application-ai-gate__rules" aria-label="AI use policy summary">
          <article><span>01</span><div><strong>Write your own answers</strong><p>Every substantive response must reflect your own judgment, experience, and writing.</p></div></article>
          <article><span>02</span><div><strong>No AI drafting or rewriting</strong><p>Do not use AI to generate, rewrite, expand, polish, paraphrase, or improve application responses.</p></div></article>
          <article><span>03</span><div><strong>Immediate denial</strong><p>If LSCSO determines prohibited AI assistance was used, the application will be denied immediately.</p></div></article>
        </div>
        <label className={`application-ai-gate__acknowledgement ${aiPolicyAccepted ? "is-accepted" : ""}`}>
          <input type="checkbox" checked={aiPolicyAccepted} onChange={(event) => setAiPolicyAccepted(event.target.checked)} />
          <span><strong>I understand and agree.</strong><small>{APPLICATION_AI_ACKNOWLEDGEMENT_TEXT}</small></span>
        </label>
        <div className="application-ai-gate__footer"><span>Your acknowledgement will be retained with your submitted candidate record.</span><button className="button button--dark" type="button" disabled={!aiPolicyAccepted} onClick={() => { setAiGatePassed(true); setError(""); setTimeout(scrollToWorkspace, 0); }}>I Understand — Begin Application</button></div>
      </section>
    );
  }

  return (
    <div className="application-workspace">
      <aside className="application-briefing" aria-label="Forensics Specialist application briefing">
        <div className="application-briefing__identity"><Image src="/images/lscso-patch-color.png" alt="" aria-hidden="true" width={56} height={56} /><div><span>LSCSO Recruitment</span><strong>Forensics Specialist Packet</strong></div></div>
        <div className="application-briefing__current"><span>Current section</span><strong>{currentSection?.title ?? "Applicant Certification"}</strong><p>{currentSection?.description ?? "Review your certification, apply your electronic signature, and transmit the completed packet to Command."}</p></div>
        <ol className="application-briefing__steps">
          {sections.map((section, index) => <li key={`${section.title}-${index}`} className={index === step ? "is-current" : index < step ? "is-complete" : ""}><button type="button" onClick={() => goBackTo(index)} disabled={index >= step}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{section.shortTitle}</strong><small>{index < step ? "Completed" : index === step ? "In progress" : "Pending"}</small></div></button></li>)}
          <li className={step === sections.length ? "is-current" : ""}><button type="button" disabled><span>{String(totalSteps).padStart(2, "0")}</span><div><strong>Certification</strong><small>{step === sections.length ? "In progress" : "Pending"}</small></div></button></li>
        </ol>
        <div className="application-briefing__note"><span>Command is evaluating</span><p>Integrity, attention to detail, evidence handling, objective technical judgment, communication, and your ability to support investigations without compromising the record.</p></div>
      </aside>

      <form className="application-form" onSubmit={submit}>
        <div className="application-progress" aria-label={`Application section ${step + 1} of ${totalSteps}`}><div className="application-progress__top"><div><span>Forensics Packet Progress</span><strong>{currentSection?.title ?? "Applicant Certification"}</strong></div><b>{step + 1} / {totalSteps}</b></div><div className="application-progress__bar"><span style={{ width: `${((step + 1) / totalSteps) * 100}%` }} /></div></div>

        {step < sections.length && currentSection ? (
          <fieldset className="application-section">
            <legend className="sr-only">{currentSection.title}</legend>
            <header className="application-section__header"><div className="application-section__number">{String(step + 1).padStart(2, "0")}</div><div><p>{currentSection.eyebrow}</p><h2>{currentSection.title}</h2><span>{currentSection.description}</span></div></header>
            <div className={`application-question-grid ${currentSection.questions.every((question) => question.questionType === "short_text") ? "application-question-grid--compact" : ""}`}>
              {currentSection.questions.map((question, questionIndex) => {
                const value = values[question.questionKey] || "";
                const compact = question.questionType === "short_text";
                const options = question.questionType === "yes_no" ? ["Yes", "No"] : question.options;
                return <div className={`application-question ${compact ? "application-question--compact" : ""}`} key={question.id}>
                  <div className="application-question__heading"><span className="application-question__number">{String(questionOffset + questionIndex + 1).padStart(2, "0")}</span><div><label htmlFor={question.questionKey}>{question.prompt}{question.required ? <em className="application-required"> Required</em> : null}</label>{question.helpText ? <small>{question.helpText}</small> : null}</div></div>
                  {question.questionType === "long_text" ? <textarea id={question.questionKey} rows={6} value={value} placeholder={question.placeholder ?? undefined} onChange={(event) => setValue(question.questionKey, event.target.value)} /> : question.questionType === "short_text" ? <input id={question.questionKey} value={value} placeholder={question.placeholder ?? undefined} onChange={(event) => setValue(question.questionKey, event.target.value)} /> : <div className="application-choice-grid">{options.map((option) => <label key={option} className={value === option ? "is-selected" : ""}><input type="radio" name={question.questionKey} value={option} checked={value === option} onChange={() => setValue(question.questionKey, option)} /><span>{option}</span></label>)}</div>}
                </div>;
              })}
            </div>
          </fieldset>
        ) : (
          <section className="application-section application-certification">
            <header className="application-section__header"><div className="application-section__number">{String(totalSteps).padStart(2, "0")}</div><div><p>Final Certification</p><h2>Review and sign your candidate record.</h2><span>Your signature certifies the accuracy of the information you submitted.</span></div></header>
            <div className="application-certification__statement"><p>{APPLICATION_CERTIFICATION_TEXT}</p></div>
            <div className="application-signature-card"><span>Electronic signature</span><strong>{signed ? signatureName : fullName || "Applicant name not entered"}</strong><small>{signedAt ? `Signed ${new Date(signedAt).toLocaleString()}` : "Signatures must match the applicant name on this record."}</small><div className="button-row">{signed ? <button className="button button--outline" type="button" onClick={() => { setSignatureName(""); setSignedAt(null); }}>Clear signature</button> : <button className="button button--dark" type="button" onClick={signApplication}>Click to Sign</button>}</div></div>
          </section>
        )}

        {error ? <p className="application-error" role="alert">{error}</p> : null}
        <div className="application-form__actions">
          <button className="button button--outline" type="button" onClick={previousStep} disabled={step === 0 || submitting}>Previous</button>
          {step < sections.length ? <button className="button button--dark" type="button" onClick={nextStep}>Continue</button> : <button className="button button--dark" type="submit" disabled={submitting || !signed}>{submitting ? "Transmitting…" : "Submit Forensics Application"}</button>}
        </div>
      </form>
    </div>
  );
}
