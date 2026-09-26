import Link from "next/link";

export type PersonnelRecordSection = "overview" | "timeline" | "supervision" | "training" | "recognition" | "documents" | "administration";

type RecordItem = {
  id: PersonnelRecordSection;
  label: string;
  description: string;
  href: string;
  glyph: string;
};

type RecordGroup = {
  label: string;
  description: string;
  items: RecordItem[];
};

export function PersonnelRecordTabs({ personnelId, active }: { personnelId: string; active: PersonnelRecordSection }) {
  const base = `/portal/command/personnel/${personnelId}`;
  const groups: RecordGroup[] = [
    {
      label: "Profile",
      description: "Current standing and complete service record",
      items: [
        { id: "overview", label: "Overview", description: "Standing, authority, assignments and immediate actions", href: base, glyph: "OV" },
        { id: "timeline", label: "Service History", description: "Chronological career and personnel activity", href: `${base}/timeline`, glyph: "SH" },
      ],
    },
    {
      label: "Operations",
      description: "Assignment, access and professional readiness",
      items: [
        { id: "administration", label: "Administration", description: "Rank, assignments, callsign, access and leave", href: `${base}/administration`, glyph: "AD" },
        { id: "training", label: "Training & Certifications", description: "FTO progress, training and qualifications", href: `${base}/training`, glyph: "TR" },
      ],
    },
    {
      label: "Performance",
      description: "Accountability, recognition and official record files",
      items: [
        { id: "supervision", label: "Accountability", description: "Guardians, oversight and disciplinary point record", href: `${base}/supervision`, glyph: "AC" },
        { id: "recognition", label: "Recognition", description: "Awards, commendations and permanent recognition", href: `${base}/recognition`, glyph: "RC" },
        { id: "documents", label: "Documents", description: "Letters, files and acknowledgments", href: `${base}/documents`, glyph: "DC" },
      ],
    },
  ];

  const activeGroup = groups.find((group) => group.items.some((item) => item.id === active));

  return (
    <nav className="personnel-record-navigation" aria-label="Personnel record sections">
      <div className="personnel-record-navigation__context">
        <span>Record navigation</span>
        <strong>{activeGroup?.label ?? "Personnel record"}</strong>
        <small>{activeGroup?.description}</small>
      </div>
      <div className="personnel-record-navigation__groups">
        {groups.map((group) => (
          <section className={group === activeGroup ? "is-active-group" : undefined} key={group.label} aria-label={`${group.label} record sections`}>
            <div className="personnel-record-navigation__group-heading">
              <span>{group.label}</span>
              <small>{group.description}</small>
            </div>
            <div className="personnel-record-navigation__links">
              {group.items.map((item) => {
                const isActive = active === item.id;
                return (
                  <Link
                    key={item.id}
                    className={isActive ? "is-active" : undefined}
                    aria-current={isActive ? "page" : undefined}
                    href={item.href}
                    title={item.description}
                  >
                    <span className="personnel-record-navigation__glyph" aria-hidden="true">{item.glyph}</span>
                    <span className="personnel-record-navigation__label">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <span className="personnel-record-navigation__arrow" aria-hidden="true">→</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}
