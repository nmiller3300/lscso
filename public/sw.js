self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "LSCSO Notification";
  const options = {
    body: payload.body || "A new LSCSO portal notification is available.",
    icon: "/images/lscso-patch-color.png",
    badge: "/images/lscso-patch-color.png",
    tag: payload.tag || "lscso-notification",
    renotify: true,
    data: {
      url: payload.url || "/portal/notifications",
      notificationType: payload.notificationType || "Portal",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/portal/notifications", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    }),
  );
});
