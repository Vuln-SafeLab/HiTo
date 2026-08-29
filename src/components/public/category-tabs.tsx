"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CategoryIcon } from "@/components/shared/category-icon";
import { GLASS } from "@/lib/liquid-glass/config";
import { useIsomorphicLayoutEffect } from "@/lib/liquid-glass/hooks";
import type { PublicCategory } from "@/lib/public-types";
import { LiquidGlassPill, type PillRect } from "./liquid-glass-pill";

const ENTRANCE = { type: "spring", stiffness: 300, damping: 30 } as const;

interface CategoryTabsProps {
  categories: PublicCategory[];
  active: string | null;
  onChange: (categoryId: string | null) => void;
}

export function CategoryTabs({ categories, active, onChange }: CategoryTabsProps) {
  const t = useTranslations("common");
  const reduceMotion = useReducedMotion();

  // "All" + each category; value=null means "all"
  const items = useMemo<Array<{ value: string | null; label: string; icon?: string }>>(
    () => [
      { value: null, label: t("all") },
      ...categories.map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
    ],
    [t, categories]
  );
  const activeIndex = Math.max(
    0,
    items.findIndex((it) => it.value === active)
  );

  const navRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const prevLeft = useRef<number | null>(null);
  const [rect, setRect] = useState<PillRect | null>(null);
  const [jumpDx, setJumpDx] = useState(0);

  const measure = useCallback(() => {
    const btn = btnRefs.current[activeIndex];
    if (btn === null || btn === undefined) return;
    const next: PillRect = {
      left: btn.offsetLeft,
      top: btn.offsetTop,
      width: btn.offsetWidth,
      height: btn.offsetHeight,
    };
    setJumpDx(prevLeft.current === null ? 0 : next.left - prevLeft.current);
    prevLeft.current = next.left;
    setRect(next);
  }, [activeIndex]);

  useIsomorphicLayoutEffect(() => {
    measure();
  }, [measure]);

  useIsomorphicLayoutEffect(() => {
    const nav = navRef.current;
    if (nav === null) return;
    let d: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(d);
      d = window.setTimeout(measure, GLASS.resizeDebounceMs);
    });
    ro.observe(nav);
    return () => {
      ro.disconnect();
      window.clearTimeout(d);
    };
  }, [measure]);

  // B15: arrow keys move and activate across tabs (roving tabindex)
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % items.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      else return;
      event.preventDefault();
      const target = items[next];
      if (target !== undefined) {
        onChange(target.value);
        btnRefs.current[next]?.focus();
      }
    },
    [items, onChange]
  );

  const radius = rect === null ? 999 : rect.height / 2;

  return (
    <motion.div
      role="tablist"
      aria-label={t("category")}
      ref={navRef}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
      initial="hidden"
      animate="show"
      className="lg-tabs relative -mx-1 flex flex-wrap items-center gap-1.5 px-1 py-1"
      style={{ touchAction: "manipulation" }}
    >
      <LiquidGlassPill rect={rect} jumpDx={jumpDx} radius={radius} />

      {items.map((it, index) => {
        const isActive = index === activeIndex;
        return (
          <motion.button
            key={it.value ?? "__all__"}
            ref={(el) => {
              btnRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            variants={{
              hidden: { opacity: 0, y: reduceMotion === true ? 0 : 8 },
              show: { opacity: 1, y: 0, transition: ENTRANCE },
            }}
            whileTap={reduceMotion === true ? undefined : { scale: GLASS.press.scale }}
            transition={GLASS.spring.press}
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            onPointerCancel={(e) => e.currentTarget.blur()}
            className={`relative z-10 shrink-0 select-none rounded-full px-4 py-1.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="relative z-10 flex items-center gap-1.5">
              {it.icon !== undefined && <CategoryIcon name={it.icon} className="size-3.5" />}
              {it.label}
            </span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
