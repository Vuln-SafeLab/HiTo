"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

type Theme = "dark" | "light";

/** Sonner theme must follow live site theme — observe <html data-theme> so in-flight toasts update on switch. */
export function Toaster() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === "light" ? "light" : "dark");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--surface-2)",
          color: "var(--text-1)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
        },
      }}
    />
  );
}
