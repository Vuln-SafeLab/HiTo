import type { Transition } from "framer-motion";

export const GLASS = {
  refraction: {
    S: -112,
    chroma: 6,
    border: 0.07,
    mapBlur: 12,
    blur: 3,
    saturate: 1.5,
    dprCap: 2,
  },

  spring: {
    press: { type: "spring", stiffness: 630, damping: 45, mass: 1 } satisfies Transition,
    move: { type: "spring", stiffness: 320, damping: 29, mass: 1 } satisfies Transition,
  },

  stretch: {
    jumpFull: 320,
    max: 0.14,
    yComp: 0.5,
    durationMs: 460,
  },

  press: { scale: 0.96, radiusDelta: 2 },

  resizeDebounceMs: 120,
} as const;

export type GlassTier = "a" | "b" | "c";
