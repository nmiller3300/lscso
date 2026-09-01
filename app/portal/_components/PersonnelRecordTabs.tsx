import Link from "next/link";

export type PersonnelRecordSection = "overview" | "timeline" | "supervision" | "training" | "recognition" | "documents" | "administration";

export function PersonnelRecordTabs({ personnelId, active }: { personnelId: string; active: PersonnelRecordSection }) {
  const base = `/portal/command/personnel/${personnelId}`;
  const items: Array<{ id: PersonnelRecordSection; label: string; description: string; href: string }> = [
    { id: "overview", label: "Overview", description: "Status and next actions", href: base },
    { id: "timeline", label: "Service History", description: "Complete activity timeline", href: `${base}/timeline` },
    { id: "supervision", label: "Accountability", description: "Guardians and point record", href: `${base}/supervision` },
    { id: "training", label: "Qualifications", description: "Training and certifications", href: `${base}/training` },
    { id: "recognition", label: "Recognition", description: "Awards and commendations", href: `${base}/recognition` },
    { id: "documents", label: "Documents & Letters", description: "Welcome letters and files", href: `${base}/documents` },
    { id: "administration", label: "Administration", description: "Assignments, access, and leave", href: `${base}/administration` },
  ];

  return (
    <nav className="command-v2-record-tabs" aria-label="Personnel record sections">
      {items.map((item) => (
        <Link
          key={item.id}
          className={active === item.id ? "is-active" : undefined}
          aria-current={active === item.id ? "page" : undefined}
          href={item.href}
        >
          <strong>{item.label}</strong>
          <span>{item.description}</span>
        </Link>
      ))}
    </nav>
  );
}
