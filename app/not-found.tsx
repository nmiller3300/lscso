import Link from "next/link";

export default function NotFound() {
  return (
    <section className="not-found-page">
      <div className="site-shell">
        <p className="section-kicker">404 · Page Not Found</p>
        <h1>This page is outside our jurisdiction.</h1>
        <p>The address may have changed, or the page may no longer be available.</p>
        <Link className="route-link route-link--gold" href="/">
          <span>Return to LSCSO Home</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
