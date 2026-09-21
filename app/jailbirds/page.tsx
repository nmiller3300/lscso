import type { Metadata } from "next";
import { getActiveJailbirds } from "../../lib/jailbirds";
import "./jailbirds.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jailbirds",
  description: "Recent arrest bookings released by the Los Santos County Sheriff’s Office.",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export default async function JailbirdsPage() {
  const records = await getActiveJailbirds();

  return (
    <div className="jailbirds-page">
      <section className="jailbirds-hero">
        <div className="site-shell jailbirds-hero__inner">
          <p className="section-kicker">Recent Arrests</p>
          <div>
            <h1>Jailbirds</h1>
            <p>
              Recent booking photographs released by the Los Santos County Sheriff’s Office.
              Entries are automatically removed 72 hours after publication.
            </p>
          </div>
        </div>
      </section>

      <section className="site-shell jailbirds-content">
        <div className="jailbirds-heading">
          <div>
            <span>Booking Log</span>
            <strong>{records.length} active {records.length === 1 ? "entry" : "entries"}</strong>
          </div>
          <p>All persons shown are presumed innocent unless and until proven guilty.</p>
        </div>

        {records.length ? (
          <div className="jailbirds-grid">
            {records.map((record) => (
              <article className="jailbird-card" key={record.id}>
                <div className="jailbird-photo">
                  {record.imageUrl ? (
                    <img src={record.imageUrl} alt={`Booking photograph of ${record.full_name}`} />
                  ) : (
                    <div className="jailbird-photo__missing">Photo unavailable</div>
                  )}
                  <span className="jailbird-stamp">LSCSO</span>
                </div>
                <div className="jailbird-card__body">
                  <div className="jailbird-card__title">
                    <p>Booked</p>
                    <h2>{record.full_name}</h2>
                  </div>

                  <dl>
                    {record.booking_number ? (
                      <div>
                        <dt>Booking #</dt>
                        <dd>{record.booking_number}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Arrest Date</dt>
                      <dd>{formatDate(record.arrested_at)}</dd>
                    </div>
                    {record.charges ? (
                      <div className="jailbird-charges">
                        <dt>Charges</dt>
                        <dd>{record.charges}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="jailbirds-empty">
            <span>LSCSO</span>
            <h2>No current Jailbirds entries.</h2>
            <p>Recent booking photographs will appear here when released.</p>
          </div>
        )}
      </section>
    </div>
  );
}
