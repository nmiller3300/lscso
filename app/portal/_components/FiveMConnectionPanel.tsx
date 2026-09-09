type FiveMConnectionPanelProps = {
  continueHref?: string;
  allowSkip?: boolean;
};

export function FiveMConnectionPanel(props: FiveMConnectionPanelProps) {
  void props;

  return (
    <section className="fivem-connect-card">
      <div className="fivem-connect-heading">
        <div>
          <span className="fivem-connect-kicker">Computer integration</span>
          <h2>Temporarily unavailable</h2>
          <p>
            Game/computer account linking is currently disabled. No connection is required to use the LSCSO Personnel Portal.
          </p>
        </div>
        <span className="fivem-connect-badge">Offline</span>
      </div>
      <p className="fivem-connect-note">
        This feature will return only after LSCSO Command re-enables the server-side computer integration.
      </p>
    </section>
  );
}
