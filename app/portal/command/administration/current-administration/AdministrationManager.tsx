import { removeAdministrationMember, saveAdministrationMember } from "./actions";

type PersonnelOption = {
  id: string;
  personnel_id: string | null;
  display_name: string;
  rank: string;
  call_sign: string | null;
  division: string | null;
  status: string;
};

type AdministrationMember = {
  id: string;
  profile_id: string | null;
  display_name: string;
  rank: string;
  position_title: string;
  call_sign: string | null;
  portrait_url: string | null;
  public_bio: string | null;
  responsibilities: string[] | null;
  appointment_status: string;
  start_date: string | null;
  display_order: number;
  is_public: boolean;
  is_active: boolean;
  updated_at: string;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LS";
}

function MemberForm({ member, personnel }: { member?: AdministrationMember; personnel: PersonnelOption[] }) {
  const selected = member?.profile_id ?? "";
  return (
    <form action={saveAdministrationMember} className="administration-editor" encType="multipart/form-data">
      {member ? <input type="hidden" name="id" value={member.id} /> : null}
      <div className="administration-form-grid">
        <label className="administration-field administration-field--wide">
          <span>Personnel member</span>
          <select name="profile_id" defaultValue={selected} required>
            <option value="" disabled>Select active personnel</option>
            {personnel.map((person) => (
              <option value={person.id} key={person.id}>{person.rank} {person.display_name}{person.call_sign ? ` · ${person.call_sign}` : ""}</option>
            ))}
          </select>
          <small>Links this public leadership entry to the official personnel record.</small>
        </label>
        <label className="administration-field">
          <span>Public display name</span>
          <input name="display_name" defaultValue={member?.display_name ?? ""} placeholder="Uses roster name if blank" />
        </label>
        <label className="administration-field">
          <span>Rank</span>
          <input name="rank" defaultValue={member?.rank ?? ""} placeholder="Uses current rank if blank" />
        </label>
        <label className="administration-field">
          <span>Position title</span>
          <input name="position_title" defaultValue={member?.position_title ?? ""} placeholder="Major · Patrol Division" />
        </label>
        <label className="administration-field">
          <span>Call sign</span>
          <input name="call_sign" defaultValue={member?.call_sign ?? ""} placeholder="Uses roster call sign if blank" />
        </label>
        <label className="administration-field">
          <span>Appointment</span>
          <select name="appointment_status" defaultValue={member?.appointment_status ?? "Permanent"}>
            <option>Permanent</option>
            <option>Acting</option>
          </select>
        </label>
        <label className="administration-field">
          <span>Appointment date</span>
          <input name="start_date" type="date" defaultValue={member?.start_date ?? ""} />
        </label>
        <label className="administration-field">
          <span>Display order</span>
          <input name="display_order" type="number" min="0" max="999" defaultValue={member?.display_order ?? 100} />
          <small>Lower numbers appear first.</small>
        </label>
        <label className="administration-field">
          <span>Portrait</span>
          <input name="portrait" type="file" accept="image/jpeg,image/png,image/webp,image/avif" />
          <small>JPG, PNG, WebP or AVIF · 5 MB max.</small>
        </label>
        <label className="administration-field administration-field--wide">
          <span>Public leadership biography</span>
          <textarea name="public_bio" rows={4} defaultValue={member?.public_bio ?? ""} placeholder="Describe this member’s place in the administration and leadership role." />
        </label>
        <label className="administration-field administration-field--wide">
          <span>Responsibilities</span>
          <textarea name="responsibilities" rows={5} defaultValue={(member?.responsibilities ?? []).join("\n")} placeholder={"One responsibility per line\nCoordinate assigned command functions\nOversee operational readiness"} />
          <small>Optional. One public responsibility per line, up to eight.</small>
        </label>
      </div>
      <div className="administration-visibility-row">
        <label><input type="checkbox" name="is_public" defaultChecked={member?.is_public ?? true} /><span><strong>Public</strong><small>Show this member on the Office of the Sheriff page.</small></span></label>
        <label><input type="checkbox" name="is_active" defaultChecked={member?.is_active ?? true} /><span><strong>Active administration</strong><small>Keep this appointment in the current administration.</small></span></label>
      </div>
      <div className="administration-editor-actions">
        <button className="portal-button portal-button--primary" type="submit">{member ? "Save leadership record" : "Add to current administration"}</button>
      </div>
    </form>
  );
}

export function AdministrationManager({ members, personnel }: { members: AdministrationMember[]; personnel: PersonnelOption[] }) {
  const active = members.filter((member) => member.is_active);
  const inactive = members.filter((member) => !member.is_active);

  return (
    <div className="administration-management-stack">
      <section className="portal-panel administration-management-summary">
        <div className="portal-panel-heading">
          <div><p>Office of the Sheriff</p><h2>Current Administration</h2></div>
          <span>{active.length} active</span>
        </div>
        <p>Control the leadership roster shown publicly by the Office of the Sheriff. Changes made here become the source of truth for names, titles, ordering, biographies, portraits, and public visibility.</p>
        <div className="administration-stat-strip">
          <article><span>Current</span><strong>{active.length}</strong><small>Active appointments</small></article>
          <article><span>Public</span><strong>{active.filter((member) => member.is_public).length}</strong><small>Published leaders</small></article>
          <article><span>Portraits</span><strong>{active.filter((member) => member.portrait_url).length}</strong><small>Profiles with imagery</small></article>
          <article><span>Archived here</span><strong>{inactive.length}</strong><small>Inactive appointments</small></article>
        </div>
      </section>

      <section className="portal-panel administration-add-panel">
        <details>
          <summary>
            <span className="administration-summary-icon">+</span>
            <span><strong>Add administration member</strong><small>Create a new public leadership appointment from an active personnel record.</small></span>
            <b aria-hidden="true">⌄</b>
          </summary>
          <MemberForm personnel={personnel} />
        </details>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Published leadership</p><h2>Administration roster</h2></div><span>Drag-free ordering · numeric priority</span></div>
        <div className="administration-member-list">
          {active.map((member, index) => (
            <article className="administration-member-card" key={member.id}>
              <div className="administration-member-display">
                <div className={`administration-member-portrait${member.portrait_url ? " has-photo" : ""}`} style={member.portrait_url ? { backgroundImage: `url(${member.portrait_url})` } : undefined}>
                  {!member.portrait_url ? <span>{initials(member.display_name)}</span> : null}
                </div>
                <div className="administration-member-identity">
                  <div className="administration-member-meta"><span>{String(index + 1).padStart(2, "0")}</span><b>{member.appointment_status}</b>{member.is_public ? <em>Public</em> : <em className="is-muted">Hidden</em>}</div>
                  <small>{member.rank}</small>
                  <h3>{member.display_name}</h3>
                  <p>{member.position_title}</p>
                  <strong>{member.call_sign || "No call sign"}</strong>
                </div>
                <div className="administration-member-order"><span>Order</span><strong>{member.display_order}</strong></div>
              </div>
              {member.public_bio ? <p className="administration-member-bio">{member.public_bio}</p> : null}
              <details className="administration-member-edit">
                <summary><span>Edit public profile & appointment</span><b aria-hidden="true">⌄</b></summary>
                <MemberForm member={member} personnel={personnel} />
              </details>
              <form action={removeAdministrationMember} className="administration-remove-form">
                <input type="hidden" name="id" value={member.id} />
                <button type="submit">Remove from current administration</button>
              </form>
            </article>
          ))}
          {!active.length ? <div className="portal-empty-state"><strong>No active administration members.</strong><span>Add a member above to publish the Office of the Sheriff leadership roster.</span></div> : null}
        </div>
      </section>

      {inactive.length ? <section className="portal-panel administration-inactive-panel">
        <details>
          <summary><span><strong>Inactive administration records</strong><small>{inactive.length} retained record{inactive.length === 1 ? "" : "s"}</small></span><b aria-hidden="true">⌄</b></summary>
          <div className="administration-inactive-list">
            {inactive.map((member) => (
              <details key={member.id} className="administration-inactive-record">
                <summary><span><strong>{member.rank} {member.display_name}</strong><small>{member.position_title}</small></span><b>Restore / edit</b></summary>
                <MemberForm member={member} personnel={personnel} />
              </details>
            ))}
          </div>
        </details>
      </section> : null}
    </div>
  );
}
