import Link from "next/link";

export type PersonnelRecordSection = "overview" | "timeline" | "supervision" | "training" | "recognition" | "documents" | "administration";

export function PersonnelRecordTabs({ personnelId, active }: { personnelId: string; active: PersonnelRecordSection }) {
  const base = `/portal/command/personnel/${personnelId}`;
  const items: Array<{ id: PersonnelRecordSection; label: string; description: string; href: string }> = [
    { id: "overview", label: "Overview", description: "Current standing and next actions", href: base },
    { id: "administration", label: "Administration", description: "Rank, assignments, callsign, access, and LOA", href: `${base}/administration` },
    { id: "training", label: "Training & Certifications", description: "Training progress, FTO, and qualifications", href: `${base}/training` },
    { id: "supervision", label: "Accountability", description: "Guardians, oversight, and point record", href: `${base}/supervision` },
    { id: "recognition", label: "Recognition", description: "Awards and commendations", href: `${base}/recognition` },
    { id: "documents", label: "Documents", description: "Letters, files, and acknowledgements", href: `${base}/documents` },
    { id: "timeline", label: "Service History", description: "Complete chronological personnel record", href: `${base}/timeline` },
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
