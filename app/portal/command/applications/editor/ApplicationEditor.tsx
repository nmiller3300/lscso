"use client";

import { useMemo, useState } from "react";
import { PortalDialog } from "../../../_components/PortalDialog";
import type { ApplicationQuestionType, RecruitmentApplicationQuestion } from "@/lib/recruitment/application";
import styles from "./ApplicationEditor.module.css";

type Draft = {
  id?: string;
  sectionTitle: string;
  sectionShortTitle: string;
  sectionEyebrow: string;
  sectionDescription: string;
  prompt: string;
  questionType: ApplicationQuestionType;
  helpText: string;
  placeholder: string;
  optionsText: string;
  required: boolean;
  active: boolean;
  locked: boolean;
};

const typeLabels: Record<ApplicationQuestionType, string> = {
  short_text: "Text",
  long_text: "Long Text",
  multiple_choice: "Multiple Choice",
  yes_no: "Yes / No",
};

function toDraft(question?: RecruitmentApplicationQuestion): Draft {
  if (!question) return {
    sectionTitle: "Applicant Information",
    sectionShortTitle: "Application",
    sectionEyebrow: "Candidate Review",
    sectionDescription: "Complete each question carefully and answer in your own words.",
    prompt: "",
    questionType: "short_text",
    helpText: "",
    placeholder: "",
    optionsText: "",
    required: true,
    active: true,
    locked: false,
  };
  return {
    id: question.id,
    sectionTitle: question.sectionTitle,
    sectionShortTitle: question.sectionShortTitle,
    sectionEyebrow: question.sectionEyebrow,
    sectionDescription: question.sectionDescription,
    prompt: question.prompt,
    questionType: question.questionType,
    helpText: question.helpText ?? "",
    placeholder: question.placeholder ?? "",
    optionsText: question.options.join("\n"),
    required: question.required,
    active: question.active,
    locked: question.locked,
  };
}

function mapApiQuestion(row: any): RecruitmentApplicationQuestion {
  return {
    id: String(row.id), questionKey: String(row.question_key), sectionTitle: String(row.section_title), sectionShortTitle: String(row.section_short_title),
    sectionEyebrow: String(row.section_eyebrow), sectionDescription: String(row.section_description), prompt: String(row.prompt), questionType: row.question_type,
    helpText: row.help_text ?? null, placeholder: row.placeholder ?? null, options: Array.isArray(row.options) ? row.options.map(String) : [], required: row.required === true,
    active: row.active === true, sortOrder: Number(row.sort_order) || 0, systemField: row.system_field ?? null, locked: row.locked === true,
  };
}

export function ApplicationEditor({ initialQuestions }: { initialQuestions: RecruitmentApplicationQuestion[] }) {
  const [questions, setQuestions] = useState(() => [...initialQuestions].sort((a, b) => a.sortOrder - b.sortOrder));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeCount = questions.filter((question) => question.active).length;
  const removedCount = questions.length - activeCount;
  const sectionCount = new Set(questions.filter((question) => question.active).map((question) => question.sectionTitle)).size;
  const existingSections = useMemo(() => [...new Set(questions.map((question) => question.sectionTitle))], [questions]);

  async function api(payload: Record<string, unknown>) {
    const response = await fetch("/api/portal/application-editor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The application form could not be updated.");
    return data;
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy(true); setError("");
    try {
      const payload = {
        action: draft.id ? "update" : "create",
        id: draft.id,
        sectionTitle: draft.sectionTitle,
        sectionShortTitle: draft.sectionShortTitle,
        sectionEyebrow: draft.sectionEyebrow,
        sectionDescription: draft.sectionDescription,
        prompt: draft.prompt,
        questionType: draft.questionType,
        helpText: draft.helpText,
        placeholder: draft.placeholder,
        options: draft.optionsText.split("\n").map((value) => value.trim()).filter(Boolean),
        required: draft.required,
        active: draft.active,
      };
      const data = await api(payload);
      const saved = mapApiQuestion(data.question);
      setQuestions((current) => {
        const next = draft.id ? current.map((question) => question.id === saved.id ? saved : question) : [...current, saved];
        return next.sort((a, b) => a.sortOrder - b.sortOrder);
      });
      setDraft(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The application form could not be updated."); }
    finally { setBusy(false); }
  }

  async function setActive(question: RecruitmentApplicationQuestion, active: boolean) {
    setBusy(true); setError("");
    try {
      await api({ action: "set_active", id: question.id, active });
      setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, active } : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The question could not be updated."); }
    finally { setBusy(false); }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    const optimistic = next.map((question, questionIndex) => ({ ...question, sortOrder: (questionIndex + 1) * 10 }));
    setQuestions(optimistic); setBusy(true); setError("");
    try { await api({ action: "reorder", ids: optimistic.map((question) => question.id) }); }
    catch (caught) { setQuestions(questions); setError(caught instanceof Error ? caught.message : "The question order could not be saved."); }
    finally { setBusy(false); }
  }

  return (
    <div className={styles.editor}>
      <section className={styles.hero}>
        <div><p>Executive form control</p><h2>Deputy Application Builder</h2><span>The published application updates immediately for future applicants. Existing submissions keep their original question snapshot.</span></div>
        <button className="portal-button portal-button--primary" type="button" onClick={() => { setError(""); setDraft(toDraft()); }}>Add question</button>
      </section>

      <div className={styles.metrics}>
        <article><span>Published questions</span><strong>{String(activeCount).padStart(2, "0")}</strong></article>
        <article><span>Application sections</span><strong>{String(sectionCount).padStart(2, "0")}</strong></article>
        <article><span>Removed / archived</span><strong>{String(removedCount).padStart(2, "0")}</strong></article>
        <article><span>Editor authority</span><strong>2</strong><small>Sheriff + Undersheriff</small></article>
      </div>

      <section className={styles.notice}><strong>Protected system fields</strong><p>Full Name and Discord Username are required for applicant identity, electronic signatures, duplicate detection, and interview contact. Their wording can be edited, but they cannot be removed or converted to another format.</p></section>
      {error ? <p className="application-error" role="alert">{error}</p> : null}

      <section className={styles.list}>
        <div className={styles.listHeading}><div><p>Live form order</p><h2>Questions</h2></div><span>Use the arrows to change the order applicants see.</span></div>
        {questions.map((question, index) => (
          <article className={`${styles.question} ${!question.active ? styles.removed : ""}`} key={question.id}>
            <div className={styles.order}><strong>{String(index + 1).padStart(2, "0")}</strong><div><button type="button" disabled={busy || index === 0} onClick={() => void move(index, -1)} aria-label="Move question up">↑</button><button type="button" disabled={busy || index === questions.length - 1} onClick={() => void move(index, 1)} aria-label="Move question down">↓</button></div></div>
            <div className={styles.questionBody}><div className={styles.badges}><span>{question.sectionTitle}</span><b>{typeLabels[question.questionType]}</b>{question.required ? <em>Required</em> : <em>Optional</em>}{!question.active ? <em>Removed</em> : null}{question.locked ? <em>System</em> : null}</div><h3>{question.prompt}</h3>{question.helpText ? <p>{question.helpText}</p> : null}{question.questionType === "multiple_choice" ? <small>Choices: {question.options.join(" · ")}</small> : null}</div>
            <div className={styles.actions}><button className="portal-button" type="button" disabled={busy} onClick={() => { setError(""); setDraft(toDraft(question)); }}>Edit</button>{question.active ? <button className="portal-button portal-button--danger" type="button" disabled={busy || question.locked} onClick={() => void setActive(question, false)}>Remove</button> : <button className="portal-button portal-button--primary" type="button" disabled={busy} onClick={() => void setActive(question, true)}>Restore</button>}</div>
          </article>
        ))}
      </section>

      <PortalDialog open={Boolean(draft)} onClose={() => { if (!busy) setDraft(null); }} eyebrow={draft?.id ? "Edit application question" : "Add application question"} title={draft?.id ? "Update question" : "Create a new question"} description="Changes publish to future applicant packets. Submitted applications are not rewritten." dismissOnBackdrop={!busy} footer={<><button className="portal-button portal-button--secondary" type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button><button className="portal-button portal-button--primary" type="button" disabled={busy || !draft?.prompt.trim() || !draft?.sectionTitle.trim()} onClick={() => void saveDraft()}>{busy ? "Saving…" : draft?.id ? "Save changes" : "Add question"}</button></>}>
        {draft ? <div className={styles.form}>
          <label>Section<select value={draft.sectionTitle} onChange={(event) => { const section = questions.find((question) => question.sectionTitle === event.target.value); setDraft({ ...draft, sectionTitle: event.target.value, sectionShortTitle: section?.sectionShortTitle ?? draft.sectionShortTitle, sectionEyebrow: section?.sectionEyebrow ?? draft.sectionEyebrow, sectionDescription: section?.sectionDescription ?? draft.sectionDescription }); }}><option value={draft.sectionTitle}>{draft.sectionTitle}</option>{existingSections.filter((section) => section !== draft.sectionTitle).map((section) => <option key={section}>{section}</option>)}<option value="__new__">+ New section</option></select></label>
          {draft.sectionTitle === "__new__" ? <label>New section name<input value="" autoFocus onChange={(event) => setDraft({ ...draft, sectionTitle: event.target.value })} placeholder="Example: Community Conduct" /></label> : null}
          <div className={styles.two}><label>Sidebar title<input value={draft.sectionShortTitle} onChange={(event) => setDraft({ ...draft, sectionShortTitle: event.target.value })} placeholder="Short section name" /></label><label>Section eyebrow<input value={draft.sectionEyebrow} onChange={(event) => setDraft({ ...draft, sectionEyebrow: event.target.value })} placeholder="Example: Candidate Judgment" /></label></div>
          <label>Section description<textarea rows={2} value={draft.sectionDescription} onChange={(event) => setDraft({ ...draft, sectionDescription: event.target.value })} /></label>
          <label>Question<textarea rows={3} value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} placeholder="Enter the question applicants will see…" /></label>
          <div className={styles.two}><label>Format<select value={draft.questionType} disabled={draft.locked} onChange={(event) => setDraft({ ...draft, questionType: event.target.value as ApplicationQuestionType })}><option value="short_text">Text</option><option value="long_text">Long Text</option><option value="multiple_choice">Multiple Choice</option><option value="yes_no">Yes / No</option></select></label><label className={styles.check}><input type="checkbox" checked={draft.required} disabled={draft.locked} onChange={(event) => setDraft({ ...draft, required: event.target.checked })} /><span>Required question</span></label></div>
          {draft.questionType === "multiple_choice" ? <label>Multiple choice options<textarea rows={5} value={draft.optionsText} onChange={(event) => setDraft({ ...draft, optionsText: event.target.value })} placeholder={"One option per line\nOption A\nOption B"} /><small>Enter one choice per line. At least two are required.</small></label> : null}
          <label>Helper text <small>Optional</small><textarea rows={2} value={draft.helpText} onChange={(event) => setDraft({ ...draft, helpText: event.target.value })} placeholder="Additional context shown below the question…" /></label>
          {(draft.questionType === "short_text" || draft.questionType === "long_text") ? <label>Placeholder <small>Optional</small><input value={draft.placeholder} onChange={(event) => setDraft({ ...draft, placeholder: event.target.value })} placeholder="Example response or guidance…" /></label> : null}
        </div> : null}
      </PortalDialog>
    </div>
  );
}
