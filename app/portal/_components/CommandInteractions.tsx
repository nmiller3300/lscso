type NotificationItem = {
  time: string;
  title: string;
  detail: string;
  type: string;
};

export function CommandActivity({ notifications }: { notifications: NotificationItem[] }) {
  return (
    <section className="portal-panel portal-activity" id="notifications">
      <span aria-hidden="true" id="audit" />
      <div className="portal-panel-heading">
        <div><p>Shared activity center</p><h2>Recent activity</h2></div>
        <span>{notifications.length ? `${notifications.length} recent` : "Caught up"}</span>
      </div>
      <div className="portal-activity-list">
        {notifications.map((item) => {
          const id = `${item.time}-${item.title}-${item.detail}`;
          return (
            <div className="portal-activity-item" key={id}>
              <span />
              <div>
                <small>{item.type} · {item.time}</small>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              <b>Recorded</b>
            </div>
          );
        })}
        {notifications.length === 0 ? (
          <div className="portal-empty-state"><strong>No recent personnel activity.</strong></div>
        ) : null}
      </div>
    </section>
  );
}
