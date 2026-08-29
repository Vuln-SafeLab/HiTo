"use client";

import { useEffect } from "react";

// Access token TTL is 900s: refresh every 10 minutes + on tab becoming visible.
// Server guard has a refresh-token fallback path; double protection prevents sudden logout.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function SessionKeeper() {
  useEffect(() => {
    const refresh = (): void => {
      void fetch("/api/auth/refresh", { method: "POST" }).catch(() => undefined);
    };

    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    const onVisible = (): void => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
