"use client";

import { useEffect, useState } from "react";

export function LocalDateTime({ value, fallback = "Pending" }: { value?: string | null; fallback?: string }) {
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    if (!value) {
      setLabel(fallback);
      return;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      setLabel(fallback);
      return;
    }
    setLabel(date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }));
  }, [value, fallback]);

  return value ? <time dateTime={value}>{label}</time> : <span>{fallback}</span>;
}
