"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { GLASS } from "@/lib/liquid-glass/config";
import {
  buildDisplacementMap,
  filterUrl,
  sanitizeId,
} from "@/lib/liquid-glass/displacement-map";
import { useGlassTier, useIsomorphicLayoutEffect } from "@/lib/liquid-glass/hooks";

export interface PillRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface LiquidGlassPillProps {
  /** Target rect in nav content coords; measured by parent (B16) */
  rect: PillRect | null;
  /** Horizontal jump distance in px, drives stretch pulse (§4③) */
  jumpDx: number;
  /** Border radius in px; pill is always capsule (height/2) */
  radius: number;
}

export function LiquidGlassPill({ rect, jumpDx, radius }: LiquidGlassPillProps) {
  const rawId = useId();
  const filterId = sanitizeId(`lg-${rawId}`);
  const tier = useGlassTier();
  const reduceMotion = useReducedMotion();
  const crossfade = reduceMotion === true;

  const surfaceRef = useRef<HTMLDivElement>(null);
  const [mapUri, setMapUri] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<string | null>(null);

  const stretchTarget = useMemo(() => {
    if (crossfade) return 0;
    return Math.min(Math.abs(jumpDx) / GLASS.stretch.jumpFull, 1) * GLASS.stretch.max;
  }, [jumpDx, crossfade]);

  const pulse = useMotionValue(0);
  const pulseSpring = useSpring(pulse, GLASS.spring.move);
  const scaleX = useTransform(pulseSpring, (v) => 1 + v);
  const scaleY = useTransform(pulseSpring, (v) => 1 - v * GLASS.stretch.yComp);

  useIsomorphicLayoutEffect(() => {
    if (rect === null || stretchTarget === 0) return;
    pulse.set(stretchTarget);
    const t = window.setTimeout(() => pulse.set(0), 16);
    return () => window.clearTimeout(t);
  }, [rect?.left, rect?.top, stretchTarget, pulse]);

  useIsomorphicLayoutEffect(() => {
    if (tier !== "a") {
      setBackdrop(null);
      return;
    }
    const el = surfaceRef.current;
    if (el === null) return;

    let raf = 0;
    let debounce: number | undefined;
    const rebuild = (): void => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      setMapUri(
        buildDisplacementMap({
          width: r.width,
          height: r.height,
          radius,
          dpr: window.devicePixelRatio || 1,
        })
      );
    };
    const schedule = (): void => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(rebuild);
      }, GLASS.resizeDebounceMs);
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);

    const dppx = window.devicePixelRatio || 1;
    const mq = window.matchMedia(`(resolution: ${dppx}dppx)`);
    const onDpr = (): void => schedule();
    mq.addEventListener("change", onDpr);

    return () => {
      ro.disconnect();
      mq.removeEventListener("change", onDpr);
      window.clearTimeout(debounce);
      cancelAnimationFrame(raf);
    };
  }, [tier, radius, crossfade]);

  useIsomorphicLayoutEffect(() => {
    if (tier !== "a" || mapUri === null) return;
    const { blur, saturate } = GLASS.refraction;
    setBackdrop(`${filterUrl(filterId)} blur(${blur}px) saturate(${saturate})`);
  }, [tier, mapUri, filterId]);

  if (rect === null) return null;

  const { S, chroma } = GLASS.refraction;
  const backdropStyle =
    backdrop !== null ? { backdropFilter: backdrop, WebkitBackdropFilter: backdrop } : {};

  const svgFilter =
    tier === "a" && mapUri !== null ? (
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
      >
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feImage href={mapUri} result="MAP" preserveAspectRatio="none" />
            <feDisplacementMap in="SourceGraphic" in2="MAP" scale={S + chroma} xChannelSelector="R" yChannelSelector="B" result="R" />
            <feDisplacementMap in="SourceGraphic" in2="MAP" scale={S} xChannelSelector="R" yChannelSelector="B" result="G" />
            <feDisplacementMap in="SourceGraphic" in2="MAP" scale={S - chroma} xChannelSelector="R" yChannelSelector="B" result="B" />
            <feColorMatrix in="R" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="Ro" />
            <feColorMatrix in="G" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="Go" />
            <feColorMatrix in="B" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="Bo" />
            <feBlend in="Ro" in2="Go" mode="screen" result="RG" />
            <feBlend in="RG" in2="Bo" mode="screen" />
          </filter>
        </defs>
      </svg>
    ) : null;

  const box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };

  if (crossfade) {
    return (
      <>
        {svgFilter}
        <AnimatePresence>
          <motion.div
            key={`${rect.left}:${rect.top}`}
            className="lg-pill pointer-events-none absolute rounded-full"
            style={{ ...box, ...backdropStyle }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            aria-hidden="true"
          >
            <div ref={surfaceRef} className="absolute inset-0 rounded-full" />
          </motion.div>
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      {svgFilter}
      <motion.div
        layout
        layoutId="category-glass-pill"
        transition={GLASS.spring.move}
        className="lg-pill pointer-events-none absolute rounded-full"
        style={{ ...box, scaleX, scaleY, ...backdropStyle }}
        aria-hidden="true"
      >
        <div ref={surfaceRef} className="absolute inset-0 rounded-full" />
        <span className="lg-sweep" aria-hidden="true" />
      </motion.div>
    </>
  );
}
