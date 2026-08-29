"use client";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive match; uses neutral background (not gradient emphasis) */
export function Highlight({ text, query }: { text: string; query: string }) {
  const keyword = query.trim();
  if (keyword === "") return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegExp(keyword)})`, "ig"));
  const lowered = keyword.toLowerCase();

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === lowered ? (
          <mark key={index} className="rounded-[3px] bg-surface-3 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}
