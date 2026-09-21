import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveJailbirdById } from "../../../lib/jailbirds";
import "../jailbirds.css";

export const dynamic = "force-dynamic";

type JailbirdProfilePageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatReleaseDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function splitCharges(value: string | null) {
  if (!value) return [];
  return value
    .split(/\r?\n|\s*;\s*/)
    .map((charge) => charge.trim())
    .filter(Boolean);
}

export async function generateMetadata({ params }: JailbirdProfilePageProps): Promise<Metadata> {
  const { id } = await params;
  const record = await getActiveJailbirdById(id);

  if (!record) {
    return { title: "Booking Not Available | Jailbirds" };
  }

  return {
    title: `${record.full_name} | Jailbirds`,
    description: `Public booking information for ${record.full_name}, released by the Los Santos County Sheriff’s Office.`,
  };
}

export default async function JailbirdProfilePage({ params }: JailbirdProfilePageProps) {
  const { id } = await params;
  const record = await getActiveJailbirdById(id);
  if (!record) notFound();

  const charges = splitCharges(record.charges);

  return (
    <div className="jailbirds-page jailbird-profile-page">
      <section className="jailbird-profile-hero">
        <div className="site-shell jailbird-profile-hero__inner">
          <Link className="jailbird-profile-back" href="/jailbirds">← Back to Jailbirds</Link>
          <div className="jailbird-profile-hero__copy">
            <div>
              <p className="section-kicker">Public Booking Release</p>
              <h1>{record.full_name}</h1>
            </div>
            <div className="jailbird-profile-status">
              <span>LSCSO</span>
              <strong>Active booking release</strong>
              <small>Automatically removed {formatReleaseDate(record.expires_at)}</small>
            </div>
          </div>
        </div>
      </section>

      <main className="site-shell jailbird-profile-content">
        <section className="jailbird-profile-record">
          <div className="jailbird-profile-photo-wrap">
            <div className="jailbird-profile-photo">
              {record.imageUrl ? (
                <img src={record.imageUrl} alt={`Booking photograph of ${record.full_name}`} />
              ) : (
                <div className="jailbird-photo__missing">Photo unavailable</div>
              )}
              <span className="jailbird-stamp">LSCSO BOOKING</span>
            </div>
            <div className="jailbird-profile-photo-caption">
              <span>Booking photograph</span>
              <small>Los Santos County Sheriff’s Office</small>
            </div>
          </div>

          <div className="jailbird-profile-sheet">
            <header>
              <div>
                <span>Booking Record</span>
                <h2>{record.full_name}</h2>
              </div>
              <b>Public Release</b>
            </header>

            <dl className="jailbird-profile-facts">
              {record.booking_number ? (
                <div>
                  <dt>Booking Number</dt>
                  <dd>{record.booking_number}</dd>
                </div>
              ) : null}
              <div>
                <dt>Arrest Date / Time</dt>
                <dd>{formatDate(record.arrested_at)}</dd>
              </div>
              <div>
                <dt>Agency</dt>
                <dd>Los Santos County Sheriff’s Office</dd>
              </div>
              <div>
                <dt>Release Window</dt>
                <dd>72 hours from publication</dd>
              </div>
            </dl>

            <section className="jailbird-profile-charges">
              <div className="jailbird-profile-section-heading">
                <span>Arrest Information</span>
                <h3>Listed Charges</h3>
              </div>

              {charges.length ? (
                <ol>
                  {charges.map((charge, index) => (
                    <li key={`${charge}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{charge}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="jailbird-profile-no-charges">
                  No charge information was included with this public release.
                </div>
              )}
            </section>

            <footer className="jailbird-profile-disclaimer">
              <strong>Presumption of innocence</strong>
              <p>
                Arrest information reflects the booking information released by the Los Santos County
                Sheriff’s Office. An arrest or criminal charge is not evidence of guilt. All persons are
                presumed innocent unless and until proven guilty.
              </p>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
