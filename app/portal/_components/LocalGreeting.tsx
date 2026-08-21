"use client";

import { useEffect, useState } from "react";
import { usePortalProfile } from "./PortalProfileProvider";

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17) return "Good evening";
  return "Welcome back";
}

export function LocalGreeting({ name }: { name?: string }) {
  const profile = usePortalProfile();
  const [greeting, setGreeting] = useState("Welcome back");
  const [timeZone, setTimeZone] = useState("");

  useEffect(() => {
    function updateGreeting() {
      setGreeting(getGreeting(new Date().getHours()));
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
    updateGreeting();
    const interval = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return <span title={timeZone ? `Greeting based on ${timeZone}` : undefined}>{greeting}, {profile.greeting_name || name || profile.display_name}.</span>;
}
