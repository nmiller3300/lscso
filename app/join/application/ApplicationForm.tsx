"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import {
  APPLICATION_AI_ACKNOWLEDGEMENT_TEXT,
  APPLICATION_AI_POLICY_TEXT,
  APPLICATION_CERTIFICATION_TEXT,
  type RecruitmentApplicationQuestion,
} from "@/lib/recruitment/application";

type ApplicationSection = {
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  questions: RecruitmentApplicationQuestion[];
};

export function ApplicationForm({ questions }: { questions: RecruitmentApplicationQuestion[] }) {
  const sections = useMemo<ApplicationSection[]>(() => {
    const result: ApplicationSection[] = [];
    for (const question of [...questions].filter((item) => item.active).sort((a, b) => a.sortOrder - b.sortOrder)) {
      let section = result.find((item) => item.title === question.sectionTitle);
      if (!section) {
        section = {
          title: question.sectionTitle,
          shortTitle: question.sectionShortTitle || question.sectionTitle,
          eyebrow: question.sectionEyebrow || "Candidate Review",
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
      const value = values[question.questionKey]?.trim() ?? "";
      if (question.required && !value) {
        setError("Please answer every required question in this section before continuing.");
        return false;
      }
      if (value.length > 8000) {
        setError("Application answers cannot exceed 8,000 characters.");
        return false;
      }
      if (question.questionKey === "age" && question.questionType === "short_text" && value) {
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
        <div className="application-success__seal">
          <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={160} height={160} />
        </div>
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
        <div className="application-success__notice"><strong>Private applicant status page</strong><p>Your tracking link is the key to your application status. Save or bookmark it now. Anyone with the private link can view the candidate-facing status, so do not post it publicly.</p></div>
        {trackingHref ? (
          <div className="button-row">
            <a className="button button--dark" href={trackingHref}>Track My Application</a>
            <button className="button button--outline" type="button" onClick={() => void copyTrackingLink()}>{trackingCopied ? "Tracking Link Copied" : "Copy Private Tracking Link"}</button>
          </div>
        ) : null}
        <div className="application-success__notice"><strong>What happens next?</strong><p>If Command accepts your application, LSCSO staff will contact you through Discord to arrange your interview. Application acceptance is not the same as being hired. Your private status page will show the current stage, last update, and any applicant-facing message from Recruitment.</p></div>
        <p className="application-success__keep">Keep <b>APP-{applicationNumber.padStart(4, "0")}</b> and your private tracking link for your records.</p>
      </section>
    );
  }

  if (!aiGatePassed) {
    return (
      <section className="application-ai-gate" aria-labelledby="application-ai-policy-title">
        <header className="application-ai-gate__header">
          <div className="application-ai-gate__seal">
            <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={132} height={132} priority />
          </div>
          <div>
            <p>Mandatory Applicant Integrity Notice</p>
            <h2 id="application-ai-policy-title">AI assistance is prohibited.</h2>
            <span>You must read and accept this policy before the Deputy Candidate Application will open.</span>
          </div>
        </header>

        <div className="application-ai-gate__warning">
          <strong>Any detected use of AI will result in immediate denial.</strong>
          <p>{APPLICATION_AI_POLICY_TEXT}</p>
        </div>

        <div className="application-ai-gate__rules" aria-label="AI use policy summary">
          <article><span>01</span><div><strong>Write your own answers</strong><p>Every substantive response must reflect your own judgment, experience, and writing.</p></div></article>
          <article><span>02</span><div><strong>No AI drafting or rewriting</strong><p>Do not use AI to generate, rewrite, expand, polish, paraphrase, or improve application responses.</p></div></article>
          <article><span>03</span><div><strong>Immediate denial</strong><p>If LSCSO determines prohibited AI assistance was used, the application will be denied immediately.</p></div></article>
        </div>

        <label className={`application-ai-gate__acknowledgement ${aiPolicyAccepted ? "is-accepted" : ""}`}>
          <input type="checkbox" checked={aiPolicyAccepted} onChange={(event) => setAiPolicyAccepted(event.target.checked)} />
          <span><strong>I understand and agree.</strong><small>{APPLICATION_AI_ACKNOWLEDGEMENT_TEXT}</small></span>
        </label>

        <div className="application-ai-gate__footer">
          <span>Your acknowledgement will be retained with your submitted candidate record.</span>
          <button className="button button--dark" type="button" disabled={!aiPolicyAccepted} onClick={() => { setAiGatePassed(true); setError(""); setTimeout(scrollToWorkspace, 0); }}>I Understand — Begin Application</button>
        </div>
      </section>
    );
  }

  return (
    <div className="application-workspace">
      <aside className="application-briefing" aria-label="Application briefing">
        <div className="application-briefing__identity">
          <Image src="/images/lscso-patch-color.png" alt="" aria-hidden="true" width={56} height={56} />
          <div><span>LSCSO Recruitment</span><strong>Deputy Candidate Packet</strong></div>
        </div>
        <div className="application-briefing__current">
          <span>Current section</span>
          <strong>{currentSection?.title ?? "Applicant Certification"}</strong>
          <p>{currentSection?.description ?? "Review your certification, apply your electronic signature, and transmit the completed packet to Command."}</p>
        </div>
        <ol className="application-briefing__steps">
          {sections.map((section, index) => (
            <li key={`${section.title}-${index}`} className={index === step ? "is-current" : index < step ? "is-complete" : ""}>
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
          <div className="application-progress__top"><div><span>Candidate Packet Progress</span><strong>{currentSection?.title ?? "Applicant Certification"}</strong></div><b>{step + 1} / {totalSteps}</b></div>
          <div className="application-progress__bar"><span style={{ width: `${((step + 1) / totalSteps) * 100}%` }} /></div>
        </div>

        {step < sections.length && currentSection ? (
          <fieldset className="application-section">
            <legend className="sr-only">{currentSection.title}</legend>
            <header className="application-section__header">
              <div className="application-section__number">{String(step + 1).padStart(2, "0")}</div>
              <div><p>{currentSection.eyebrow}</p><h2>{currentSection.title}</h2><span>{currentSection.description}</span></div>
            </header>

            <div className={`application-question-grid ${currentSection.questions.every((question) => question.questionType === "short_text") ? "application-question-grid--compact" : ""}`}>
              {currentSection.questions.map((question, questionIndex) => {
                const value = values[question.questionKey] || "";
                const scenario = currentSection.title.toLowerCase().includes("scenario");
                const compact = question.questionType === "short_text";
                const options = question.questionType === "yes_no" ? ["Yes", "No"] : question.options;
                return (
                  <div className={`application-question ${compact ? "application-question--compact" : ""} ${scenario ? "application-question--scenario" : ""}`} key={question.id}>
                    <div className="application-question__heading">
                      <span className="application-question__number">{String(questionOffset + questionIndex + 1).padStart(2, "0")}</span>
                      <div>{scenario ? <b>Field Scenario</b> : null}<label id={`${question.questionKey}-label`} htmlFor={question.questionType === "short_text" || question.questionType === "long_text" ? question.questionKey : undefined}>{question.prompt}{question.required ? <em className="application-required"> Required</em> : null}</label>{question.helpText ? <small>{question.helpText}</small> : null}</div>
                    </div>

                    {question.questionType === "long_text" ? (
                      <><textarea id={question.questionKey} required={question.required} rows={6} maxLength={8000} placeholder={question.placeholder ?? undefined} value={value} onChange={(event) => setValue(question.questionKey, event.target.value)} /><span className="application-question__count">{value.length.toLocaleString()} / 8,000</span></>
                    ) : question.questionType === "short_text" ? (
                      <input id={question.questionKey} required={question.required} type={question.questionKey === "age" ? "number" : "text"} min={question.questionKey === "age" ? 13 : undefined} max={question.questionKey === "age" ? 100 : undefined} maxLength={question.questionKey === "age" ? undefined : 8000} placeholder={question.placeholder ?? undefined} value={value} onChange={(event) => setValue(question.questionKey, event.target.value)} />
                    ) : (
                      <div className="application-choice-grid" role="radiogroup" aria-labelledby={`${question.questionKey}-label`}>
                        {options.map((option) => (
                          <label className={`application-choice ${value === option ? "is-selected" : ""}`} key={option}>
                            <input type="radio" name={question.questionKey} value={option} checked={value === option} required={question.required} onChange={() => setValue(question.questionKey, option)} />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

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

            <div className="application-ai-reminder" role="note">
              <span>AI Use Policy</span>
              <strong>Policy acknowledged · AI assistance prohibited</strong>
              <p>By submitting this packet, you reaffirm that all substantive application responses were completed without prohibited AI assistance. Detected use will result in immediate denial.</p>
            </div>

            <div className="application-screening-notice application-screening-notice--final" role="note">
              <div className="application-screening-notice__icon" aria-hidden="true">✓</div>
              <div><span>Applicant Screening Notice</span><strong>Fingerprinting and testing requirements</strong><p>LSCSO candidates are subject to fingerprinting, blood testing, drug testing, and breathalyzer testing as part of the department&apos;s background and suitability screening process.</p></div>
            </div>

            <div className="application-certification__statement"><span>Certification statement</span><p>{APPLICATION_CERTIFICATION_TEXT}</p></div>

            <div className={`application-signature ${signed ? "is-signed" : ""}`}>
              <div className="application-signature__status"><span>Electronic Signature</span>{signed ? <><strong className="application-signature__script">{signatureName}</strong><small>Signed {new Date(signedAt!).toLocaleString()}</small></> : <><strong>Signature required</strong><small>Your full name from the application will be used as your electronic signature.</small></>}</div>
              {signed ? <button className="application-signature__clear" type="button" onClick={clearSignature}>Clear signature</button> : <button className="application-signature__button" type="button" onClick={signApplication}>Apply Electronic Signature</button>}
            </div>

            <p className="application-certification__notice">By applying your signature, you acknowledge the certification, AI Use Policy, and applicant-screening notice above and authorize LSCSO to retain the signature and acknowledgements with your application.</p>
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
