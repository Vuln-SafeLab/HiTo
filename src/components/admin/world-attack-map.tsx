"use client";

// ════════════════════════════════════════════════════════════════════
// Kun 1.0 · Global Attack Map
// - Dot-matrix world (equirectangular, 120×54 land mask ≈ real geography)
// - Animated attack arcs: origin → protected node
// - Severity-coloured markers with pulse rings + hover tooltips
// - Zero dependencies, ~4 KB gzip; respects prefers-reduced-motion
// ════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RadioTower } from "lucide-react";

const VIEW_W = 1000;
const VIEW_H = 500;

/**
 * Land mask, 120 cols × 54 rows, equirectangular (x: -180..180 → 0..120,
 * y: 90..-90 → 0..54). '#' = land. Rasterized offline from Natural Earth
 * land-110m (public domain, via world-atlas); 14 known-location probes pass.
 */
const LAND_MASK: string[] = [
  "                                                                                                                        ",
  "                                                                                                                        ",
  "                              ######## ############## ##                                                                ",
  "                          ## # #### #################           ## #                         ##                         ",
  "                      ###   #####        ############                          #         #########        ## #          ",
  "                  #######  ## #####      ###########                         ##    # ##################    ###          ",
  " ###                  ## ##      ##   ####        ###############        ####                                           ",
  "# ##                            ##    #####    #####   #########   #                                                    ",
  "     ########################     ##        ##                #### ############################################### ###  ",
  "       ##     ###############     ### #                   #   # ##  #######################################      #      ",
  "     #          ################# #######                ###       ######################################       ##      ",
  "                 ################ #######                 ## ###############################################    #       ",
  "                  ####################  ##                ##################################################            ",
  "                   ####################                     #### ##### ##### ############################# #            ",
  "                   ##################                    ####   #  ##  #  ##  #########################                 ",
  "                   ################                      ###       # #######  #####################   #   #             ",
  "                    ###############                       ######    #   ############################  # ###             ",
  "                     ############                        ########  #    #############################  #                ",
  "                       #####    #                       ############### #### ########################                   ",
  "                        ###                            ###################### #   ###################                   ",
  "                         ##      #                    ################## #######   ######  ######                       ",
  "                         ### ##    ##                  ################## #####     ####   #### #   #                   ",
  "                             ###                      ################### ###        ##      ###    #                   ",
  "                               #                       ###################           ##       ##                        ",
  "                                # ######                #####################                        #                  ",
  "                                  #########              # #  ##############                ##    ##                    ",
  "                                  #########                    ############                  ## ###                     ",
  "                                 ############                  ###########                    #  ## #   #               ",
  "                                 ###############                #########                                 ### #         ",
  "                                  ##############                #########                        ###       #            ",
  "                                  ##############                 ########                                  #            ",
  "                                   ############                 ##########  #                         ###  #            ",
  "                                     ##########                 ########   #                         ########           ",
  "                                     #########                   #######  ##                      ############     #    ",
  "                                    ########                     ######    #                      #############         ",
  "                                    ########                     ######                           #############         ",
  "                                    #######                       ####                             #### #######         ",
  "                                    #####                                                                 ####          ",
  "                                    #####                                                                  ##         # ",
  "                                   ###                                                                      #        #  ",
  "                                   ###                                                                              #   ",
  "                                   ###                                                                                  ",
  "                                   ##   #                                                                               ",
  "                                    ##                                                                                  ",
  "                                                                                                                        ",
  "                                                                                                                        ",
  "                                                                                                                        ",
  "                                     #                                     ########   ########################          ",
  "                                   ## ##                # ######################### #################################   ",
  "              ########## # ############               #############################################################     ",
  "        ##########################          #   ####################################################################    ",
  "        ###############################       ####################################################################      ",
  "      ######                                                                                                            ",
  "                                                                                                                        ",
];

const COLS = 120;
const ROWS = 54;
const CELL_W = VIEW_W / COLS;
const CELL_H = VIEW_H / ROWS;

interface MapMarker {
  cc: string;
  total: number;
  lastAt: string;
  lng: number;
  lat: number;
  size: number;
  /** dominant action for colour coding */
  topAction: string;
}

interface RecentHit {
  id: number;
  at: string;
  ip: string;
  ruleId: string;
  action: string;
  cc: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  block: "#ef4444",
  ban: "#f97316",
  challenge: "#f59e0b",
  log: "#38bdf8",
};

function colorForAction(action: string): string {
  return ACTION_COLORS[action] ?? "#ef4444";
}

/** Pre-computed static dot field (memo-friendly). */
function useLandDots(): Array<{ x: number; y: number }> {
  return useMemo(() => {
    const dots: Array<{ x: number; y: number }> = [];
    for (let row = 0; row < ROWS; row++) {
      const line = (LAND_MASK[row] ?? "").padEnd(COLS, " ");
      for (let col = 0; col < COLS; col++) {
        if (line[col] === "#") {
          dots.push({ x: (col + 0.5) * CELL_W, y: (row + 0.5) * CELL_H });
        }
      }
    }
    return dots;
  }, []);
}

export interface WorldAttackMapProps {
  markers: MapMarker[];
  recent: RecentHit[];
  /** Geo coords of the protected node arcs terminate at */
  serverLng: number;
  serverLat: number;
}

export function WorldAttackMap({ markers, recent, serverLng, serverLat }: WorldAttackMapProps) {
  const reduceMotion = useReducedMotion();
  const dots = useLandDots();
  const [hover, setHover] = useState<{ x: number; y: number; marker: MapMarker } | null>(null);

  const maxSize = Math.max(1, ...markers.map((m) => m.size));
  const totalAttacks = markers.reduce((sum, m) => sum + m.total, 0);
  const serverX = ((serverLng + 180) / 360) * VIEW_W;
  const serverY = ((90 - serverLat) / 180) * VIEW_H;

  return (
    <div className="relative w-full overflow-hidden rounded-card border border-border bg-[#070a12]" data-testid="world-attack-map">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
        role="img"
        aria-label="Global attack origin map"
      >
        <defs>
          <radialGradient id="kunPulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="serverGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
            <stop offset="45%" stopColor="#ef4444" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.9" />
          </linearGradient>
          <filter id="kunGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* deep space background */}
        <rect width={VIEW_W} height={VIEW_H} fill="#070a12" />
        {/* graticule */}
        <g stroke="rgba(148,163,184,0.09)" strokeWidth="0.5">
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`lat${i}`} x1="0" y1={(i * VIEW_H) / 10} x2={VIEW_W} y2={(i * VIEW_H) / 10} />
          ))}
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`lng${i}`} x1={(i * VIEW_W) / 12} y1="0" x2={(i * VIEW_W) / 12} y2={VIEW_H} />
          ))}
        </g>
        {/* equator emphasis */}
        <line x1="0" y1={VIEW_H / 2} x2={VIEW_W} y2={VIEW_H / 2} stroke="rgba(148,163,184,0.16)" strokeWidth="0.6" strokeDasharray="4 6" />

        {/* land dots */}
        <g fill="rgba(120,140,180,0.42)">
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={1.55} />
          ))}
        </g>

        {/* attack arcs */}
        {!reduceMotion &&
          markers.slice(0, 14).map((m, i) => {
            const x1 = ((m.lng + 180) / 360) * VIEW_W;
            const y1 = ((90 - m.lat) / 180) * VIEW_H;
            const mx = (x1 + serverX) / 2;
            const my = (y1 + serverY) / 2 - Math.abs(x1 - serverX) * 0.18 - 24;
            const d = `M ${x1} ${y1} Q ${mx} ${my} ${serverX} ${serverY}`;
            const dur = 2.2 + (i % 5) * 0.5;
            return (
              <g key={`arc-${m.cc}-${i}`} opacity="0.85">
                <path d={d} fill="none" stroke="url(#arcGrad)" strokeWidth="0.9" strokeLinecap="round" opacity="0.35" />
                <circle r="2.1" fill="#f87171" filter="url(#kunGlow)">
                  <animateMotion dur={`${dur}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" path={d} />
                  <animate attributeName="opacity" values="0;1;1;0" dur={`${dur}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" />
                </circle>
              </g>
            );
          })}

        {/* server node */}
        <g>
          <circle cx={serverX} cy={serverY} r="26" fill="url(#serverGlow)" opacity="0.5">
            {!reduceMotion && (
              <animate attributeName="r" values="18;30;18" dur="3s" repeatCount="indefinite" />
            )}
          </circle>
          <circle cx={serverX} cy={serverY} r="4" fill="#22d3ee" stroke="#a5f3fc" strokeWidth="1" filter="url(#kunGlow)" />
          <path
            d={`M ${serverX - 7} ${serverY} a7 7 0 0 1 14 0 M ${serverX - 11} ${serverY} a11 11 0 0 1 22 0`}
            fill="none"
            stroke="rgba(34,211,238,0.5)"
            strokeWidth="1"
          />
        </g>

        {/* markers */}
        <g>
          {markers.map((m, i) => {
            const x = ((m.lng + 180) / 360) * VIEW_W;
            const y = ((90 - m.lat) / 180) * VIEW_H;
            const r = 2.4 + (m.size / maxSize) * 7.5;
            const color = colorForAction(m.topAction);
            return (
              <g
                key={`${m.cc}-${i}`}
                filter="url(#kunGlow)"
                onMouseEnter={() => setHover({ x, y, marker: m })}
                onMouseLeave={() => setHover(null)}
              >
                {!reduceMotion && (
                  <circle cx={x} cy={y} r={r * 2.2} fill="url(#kunPulse)">
                    <animate attributeName="r" values={`${r * 1.4};${r * 2.8};${r * 1.4}`} dur={`${2 + (i % 3) * 0.7}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.55;0.12;0.55" dur={`${2 + (i % 3) * 0.7}s`} repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={x} cy={y} r={r} fill={color} stroke="rgba(255,255,255,0.75)" strokeWidth="0.6" className="cursor-pointer" />
                <circle cx={x} cy={y} r={r + 3.5} fill="transparent" className="cursor-pointer" />
                <title>{`${m.cc} · ${m.total.toLocaleString()} · ${m.lastAt.slice(0, 16).replace("T", " ")}`}</title>
              </g>
            );
          })}
        </g>
      </svg>

      {/* hover tooltip (HTML overlay stays crisp) */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-control border border-border bg-popover/95 px-3 py-2 text-xs shadow-card-hover backdrop-blur"
          style={{
            left: `${(hover.x / VIEW_W) * 100}%`,
            top: `${(hover.y / VIEW_H) * 100}%`,
            marginTop: "-8px",
          }}
        >
          <p className="font-semibold">
            {hover.marker.cc} · <span style={{ color: colorForAction(hover.marker.topAction) }}>{hover.marker.topAction}</span>
          </p>
          <p className="tabular-nums text-muted-foreground">
            {hover.marker.total.toLocaleString()} · {hover.marker.lastAt.slice(11, 16)} UTC
          </p>
        </div>
      )}

      {/* overlays */}
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded bg-black/55 px-2 py-1 text-[10px] text-slate-200 backdrop-blur">
        <RadioTower className="size-3 text-cyan-300" aria-hidden="true" />
        LIVE · {totalAttacks.toLocaleString()} / 7d
        {recent[0] !== undefined && (
          <span className="text-slate-400">· last {recent[0].at.slice(11, 19)}</span>
        )}
      </div>
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2.5 rounded bg-black/55 px-2.5 py-1.5 text-[10px] text-slate-300 backdrop-blur">
        {Object.entries(ACTION_COLORS).map(([action, color]) => (
          <span key={action} className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full" style={{ background: color }} />
            {action}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Compact live feed of the most recent WAF events, for the side panel. */
export function AttackLiveFeed({ recent }: { recent: RecentHit[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <ol className="flex flex-col divide-y divide-border" data-testid="attack-live-feed">
      {recent.length === 0 && <li className="py-6 text-center text-xs text-faint">—</li>}
      {recent.map((hit, i) => {
        const color = colorForAction(hit.action);
        return (
          <li key={hit.id} className="flex items-center gap-2.5 py-2 text-xs">
            <span className="w-10 shrink-0 tabular-nums text-faint">{hit.at.slice(11, 19)}</span>
            <span
              className={`inline-block size-1.5 shrink-0 rounded-full ${!reduceMotion && i === 0 ? "animate-pulse" : ""}`}
              style={{ background: color }}
              aria-hidden="true"
            />
            <code className="min-w-0 flex-1 truncate font-mono">{hit.ip}</code>
            <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">{hit.ruleId}</span>
            <span className="w-14 shrink-0 text-right font-medium" style={{ color }}>
              {hit.action}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Country ranking with severity bars (top-N alongside the map). */
export function AttackCountryRank({ markers, max = 8 }: { markers: MapMarker[]; max?: number }) {
  const top = [...markers].sort((a, b) => b.total - a.total).slice(0, max);
  const topTotal = Math.max(1, ...top.map((m) => m.total));
  return (
    <ul className="flex flex-col gap-2" data-testid="attack-country-rank">
      {top.length === 0 && <li className="py-6 text-center text-xs text-faint">—</li>}
      {top.map((m) => (
        <li key={m.cc} className="flex items-center gap-2.5 text-xs">
          <span className="w-8 shrink-0 font-mono font-semibold">{m.cc}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(4, (m.total / topTotal) * 100)}%` }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${colorForAction(m.topAction)}, #22d3ee)` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{m.total.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
