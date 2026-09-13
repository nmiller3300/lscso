"use client";

export function ArchiveEditor() {
  return (
    <div className="portal-admin-layout">
      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Current administration</p><h2>Add historical record</h2></div><span>2026–Present</span></div>
        <p className="portal-admin-intro">Build the Miller–White archive as roleplay happens. Release controls determine what may later appear in the public historical archive.</p>
      </section>
      <aside className="portal-panel">
        <div className="portal-panel-heading"><div><p>Living archive</p><h2>Current holdings</h2></div></div>
        <p>No historical records have been added yet.</p>
      </aside>
    </div>
  );
}
