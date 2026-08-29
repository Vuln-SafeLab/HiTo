"use client";

import { useEffect, useRef } from "react";

const ALLOWED_TAGS = new Set([
  "A", "INS", "IMG", "DIV", "SPAN", "P", "BR", "B", "I", "U", "STRONG", "EM",
  "SCRIPT", "IFRAME",
]);

function isSafeUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.startsWith("javascript:") || v.startsWith("data:") || v.startsWith("vbscript:")) return false;
  return v.startsWith("https://") || v.startsWith("http://") || v.startsWith("/") || v === "" || v.startsWith("#") || v.startsWith("?");
}

function sanitizeNode(host: Node, source: Node): void {
  if (source.nodeType === 3) {
    host.appendChild(source.cloneNode(true));
    return;
  }
  if (source.nodeType !== 1) return;
  const el = source as Element;
  const tag = el.tagName.toUpperCase();
  if (!ALLOWED_TAGS.has(tag)) {
    for (const child of Array.from(el.childNodes)) sanitizeNode(host, child);
    return;
  }
  const out = document.createElement(tag.toLowerCase());
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) continue;
    if (name === "style") continue;
    if ((name === "src" || name === "href" || name === "formaction") && !isSafeUrl(attr.value)) continue;
    out.setAttribute(attr.name, attr.value);
  }
  if (tag === "A" && out.getAttribute("target") === "_blank") {
    out.setAttribute("rel", out.getAttribute("rel") ? `${out.getAttribute("rel")} noopener noreferrer` : "noopener noreferrer");
  }
  for (const child of Array.from(el.childNodes)) sanitizeNode(out, child);
  host.appendChild(out);
}

export function AdCodeRenderer({ code }: { code: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    host.textContent = "";
    const parsed = new DOMParser().parseFromString(code, "text/html");
    for (const node of Array.from(parsed.body.childNodes)) sanitizeNode(host, node);
    return () => {
      host.textContent = "";
    };
  }, [code]);

  return <div ref={hostRef} />;
}
