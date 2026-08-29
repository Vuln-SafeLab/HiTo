"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type { GlassTier } from "@/lib/liquid-glass/config";

export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useGlassTier(): GlassTier | null {
  const [tier, setTier] = useState<GlassTier | null>(null);
  useIsomorphicLayoutEffect(() => {
    const t = document.documentElement.dataset.glassTier;
    setTier(t === "a" || t === "b" || t === "c" ? t : "b");
  }, []);
  return tier;
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = (): void => setVisible(document.visibilityState !== "hidden");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}
