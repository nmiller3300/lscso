"use client";

import { FormEvent, useState } from "react";

const sections = [
  ["Applicant Information", [["full_name","What is your full name?","text"],["discord_username","What is your Discord username?","text"],["age","What is your age?","number"],["timezone","What is your timezone?","text"]]],
  ["Experience & Availability", [["fivem_experience","How long have you been playing FiveM and participating in serious roleplay?","textarea"],["previous_departments","What departments or factions have you previously been a member of?","textarea"],["weekly_hours","How many hours per week can you dedicate to LSCSO?","text"],["upcoming_commitments","Do you have any upcoming commitments that may affect your activity?","textarea"]]],
  ["Why LSCSO?", [["why_lscso","Why do you want to join the Los Santos County Sheriff's Office?","textarea"],["contribution","What do you believe you can contribute to LSCSO?","textarea"]]],
  ["Roleplay & Law Enforcement", [["serious_roleplay_definition","What does serious roleplay mean to you?","textarea"],["reasonable_suspicion_probable_cause","Explain the difference between reasonable suspicion and probable cause.","textarea"],["use_of_force_factors","What factors should an officer consider before using force?","textarea"]]],
  ["Scenarios", [["scenario_speeding_nervous","You stop a vehicle for speeding. The driver becomes increasingly nervous during the stop. What do you do?","textarea"],["scenario_deputy_policy_violation","You witness another deputy violating department policy. What do you do?","textarea"],["scenario_supervisor_order","A supervisor orders you to do something you believe violates department policy. How do you handle it?","textarea"]]]
] as const;

export function ApplicationForm() {
  const [values, setValues] = useState<Record<string,string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [certified, setCertified] = useState(false);
  let questionNumber = 0;

  const setValue = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, mandatory_training: "Yes", prior_discipline: "No", prior_discipline_explanation: "", applicant_certification: certified }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The application could not be submitted.");
      setApplicationNumber(String(data.application_number)); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError(err instanceof Error ? err.message : "The application could not be submitted."); }
    finally { setSubmitting(false); }
  }

  if (applicationNumber) return <section className="application-success"><p className="section-kicker section-kicker--dark">Application Received</p><h2>Thank you for applying.</h2><p>Your application has been submitted successfully for LSCSO Command review.</p><strong>Application Number: APP-{applicationNumber.padStart(4,"0")}</strong><p>Keep this number for your records.</p></section>;

  return <form className="application-form" onSubmit={submit}>
    {sections.map(([title, questions], sectionIndex) => <fieldset className="application-section" key={title}>
      <legend><span>{String(sectionIndex + 1).padStart(2,"0")}</span>{title}</legend>
      {questions.map(([name, question, type]) => { questionNumber++; return <div className="application-question" key={name}>
        <label htmlFor={name}><strong>{questionNumber}.</strong> {question}</label>
        {type === "textarea" ? <textarea id={name} required rows={5} value={values[name] || ""} onChange={(e) => setValue(name,e.target.value)} /> : <input id={name} required type={type} min={type === "number" ? 13 : undefined} max={type === "number" ? 100 : undefined} value={values[name] || ""} onChange={(e) => setValue(name,e.target.value)} />}
      </div>; })}
    </fieldset>)}
    <section className="application-certification"><h2>Applicant Certification</h2><p>I certify that the information provided in this application is truthful and accurate to the best of my knowledge. I understand that intentionally providing false information may result in denial of my application or removal from LSCSO.</p><label><input type="checkbox" required checked={certified} onChange={(e) => setCertified(e.target.checked)} /> I certify that the information above is truthful and accurate.</label></section>
    {error && <p className="application-error" role="alert">{error}</p>}
    <button className="button button--dark" type="submit" disabled={submitting}>{submitting ? "Submitting Application…" : "Submit Application"}</button>
  </form>;
}
