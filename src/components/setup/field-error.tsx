"use client";

export function FieldError({ message }: { message?: string }) {
  if (message === undefined || message === "") return null;
  // role=alert announces validation errors to screen readers immediately
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
