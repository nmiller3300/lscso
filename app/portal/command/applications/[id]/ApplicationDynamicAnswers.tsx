type SnapshotQuestion = {
  id?: string;
  questionKey?: string;
  question_key?: string;
  sectionTitle?: string;
  section_title?: string;
  prompt?: string;
};

export function ApplicationDynamicAnswers({ application }: { application: any }) {
  const answers = application.application_answers && typeof application.application_answers === "object"
    ? application.application_answers as Record<string, unknown>
    : null;
  const snapshot = Array.isArray(application.application_question_snapshot)
    ? application.application_question_snapshot as SnapshotQuestion[]
    : [];

  if (!answers || !snapshot.length) return null;

  const grouped = new Map<string, Array<{ key: string; prompt: string; answer: string }>>();
  for (const question of snapshot) {
    const key = String(question.questionKey ?? question.question_key ?? "").trim();
    if (!key) continue;
    const section = String(question.sectionTitle ?? question.section_title ?? "Application").trim() || "Application";
    const prompt = String(question.prompt ?? key.replaceAll("_", " "));
    const raw = answers[key];
    const answer = raw === null || raw === undefined || String(raw).trim() === "" ? "Not provided" : String(raw);
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push({ key, prompt, answer });
  }

  if (!grouped.size) return null;

  return (
    <section className="portal-panel">
      <div className="portal-panel-heading">
        <div><p>Submitted candidate packet</p><h2>Application answers · submitted snapshot</h2></div>
        <span>{snapshot.length} questions retained</span>
      </div>
      <p style={{ marginTop: 0, color: "rgba(255,255,255,.52)", fontSize: 13, lineHeight: 1.6 }}>
        This is the exact question set this applicant received. Later edits to the public application do not change this record.
      </p>
      {[...grouped.entries()].map(([section, items]) => (
        <div className="recruitment-answer-section" key={section}>
          <h3>{section}</h3>
          {items.map((item) => <article key={item.key}><strong>{item.prompt}</strong><p>{item.answer}</p></article>)}
        </div>
      ))}
    </section>
  );
}
