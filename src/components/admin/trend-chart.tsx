"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useFormatter, useTranslations } from "next-intl";

export interface TrendPoint {
  /** YYYY-MM-DD */
  day: string;
  count: number;
}
const W = 640;
const H = 180;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;

// Y-axis upper bound uses "nice" integers (1/2/5 × 10^n) so ticks avoid ugly values like 37
function niceCeil(value: number): number {
  if (value <= 5) return 5;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  for (const multiplier of [1, 2, 5, 10]) {
    if (value <= multiplier * base) return multiplier * base;
  }
  return 10 * base;
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const t = useTranslations("admin.dashboard");
  const format = useFormatter();
  const reduceMotion = useReducedMotion();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const max = niceCeil(Math.max(1, ...points.map((point) => point.count)));
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const xAt = (index: number): number =>
    PAD_L + (points.length <= 1 ? 0 : (index / (points.length - 1)) * innerW);
  const yAt = (value: number): number => PAD_T + innerH - (value / max) * innerH;

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index).toFixed(2)},${yAt(point.count).toFixed(2)}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L${xAt(points.length - 1).toFixed(2)},${(PAD_T + innerH).toFixed(2)} L${PAD_L},${(PAD_T + innerH).toFixed(2)} Z`
      : "";

  const formatDay = (day: string): string =>
    format.dateTime(new Date(`${day}T00:00:00`), { month: "short", day: "numeric" });

  function onMove(event: React.MouseEvent<SVGSVGElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = (px - PAD_L) / innerW;
    const index = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, index)));
  }

  const hovered = hoverIndex === null ? null : (points[hoverIndex] ?? null);
  const lastIndex = points.length - 1;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={t("trend")}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {[max / 2, max].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 8}
              y={yAt(tick) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--text-3)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {format.number(tick)}
            </text>
          </g>
        ))}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={PAD_T + innerH}
          y2={PAD_T + innerH}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {points.length > 1 && (
          <>
            <text x={PAD_L} y={H - 6} fontSize={10} fill="var(--text-3)">
              {formatDay(points[0]?.day ?? "")}
            </text>
            <text x={W - PAD_R} y={H - 6} textAnchor="end" fontSize={10} fill="var(--text-3)">
              {formatDay(points[lastIndex]?.day ?? "")}
            </text>
          </>
        )}

        <motion.path
          d={areaPath}
          fill="#8B5CF6"
          fillOpacity={0.12}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke="#8B5CF6"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={reduceMotion === true ? { opacity: 0 } : { pathLength: 0 }}
          animate={reduceMotion === true ? { opacity: 1 } : { pathLength: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />

        {points.length > 0 && (
          <circle
            cx={xAt(lastIndex)}
            cy={yAt(points[lastIndex]?.count ?? 0)}
            r={4}
            fill="#8B5CF6"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        )}

        {hovered !== null && hoverIndex !== null && (
          <g aria-hidden="true">
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="var(--text-3)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={xAt(hoverIndex)}
              cy={yAt(hovered.count)}
              r={4}
              fill="#8B5CF6"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {hovered !== null && hoverIndex !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-control border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${(xAt(hoverIndex) / W) * 100}%`,
            top: `${(yAt(hovered.count) / H) * 100}%`,
            marginTop: -8,
          }}
        >
          <span className="text-faint">{formatDay(hovered.day)}</span>{" "}
          <span className="font-medium tabular-nums">{format.number(hovered.count)}</span>
        </div>
      )}

      <table className="sr-only">
        <caption>{t("trend")}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.day}>
              <th scope="row">{point.day}</th>
              <td>{point.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
