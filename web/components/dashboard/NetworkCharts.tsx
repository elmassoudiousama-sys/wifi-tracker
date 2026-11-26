"use client";

import { useId, useState } from "react";
import type { HistoryPoint } from "@/features/dashboard/types";
import { formatClock } from "@/features/dashboard/utils";

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const gradientId = useId();
  if (values.length < 2) return <div className="spark spark-empty" />;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * 100,
    26 - ((v - min) / span) * 20,
  ]);
  const line = pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const lastPt = pts[pts.length - 1];

  return (
    <div style={{ position: "relative", width: "100%", height: 38 }}>
      <svg
        className="spark"
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
          <filter id={`glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor={color} floodOpacity="0.4" />
          </filter>
        </defs>

        <polygon points={`0,32 ${line} 100,32`} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          filter={`url(#glow-${gradientId})`}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Pulsing indicator on last point */}
        <circle
          cx={lastPt[0]}
          cy={lastPt[1]}
          r="3"
          fill={color}
          stroke="var(--surface)"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live Interactive Network Chart                                      */
/* ------------------------------------------------------------------ */

export function LiveChart({
  data,
  showRx,
  showTx,
}: {
  data: HistoryPoint[];
  showRx: boolean;
  showTx: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 230;
  const PAD = 14;
  const n = data.length;

  if (n === 0) {
    return (
      <div className="chart-empty">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div className="live-dot" style={{ width: 12, height: 12 }} />
          <span>جاري جمع قياسات الصبيب اللحظية من الراوتر…</span>
        </div>
      </div>
    );
  }

  const rawMax = Math.max(
    10,
    ...data.map((d) => Math.max(showRx ? d.rx : 0, showTx ? d.tx : 0))
  );
  const max = Math.ceil(rawMax / 10) * 10;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const path = (k: "rx" | "tx") =>
    data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join(" ");

  const areaRx = `${path("rx")} L${x(n - 1).toFixed(1)} ${H - PAD} L${x(0).toFixed(1)} ${H - PAD} Z`;
  const areaTx = `${path("tx")} L${x(n - 1).toFixed(1)} ${H - PAD} L${x(0).toFixed(1)} ${H - PAD} Z`;

  const hp = hover !== null ? data[hover] : null;
  const gridFractions = [0, 0.25, 0.5, 0.75, 1];

  const currentRx = data[n - 1]?.rx ?? 0;
  const currentTx = data[n - 1]?.tx ?? 0;
  const peakRx = Math.max(...data.map((d) => d.rx), 0);
  const peakTx = Math.max(...data.map((d) => d.tx), 0);

  return (
    <div className="chart-wrapper">
      {/* Quick stats ribbon */}
      <div className="chart-metric-strip">
        <div className="chart-stat">
          <span className="chart-stat-dot dot-ok" />
          <span className="chart-stat-label">تحميل حالي:</span>
          <strong className="chart-stat-val ltr">{currentRx} Mbps</strong>
          <small className="chart-stat-peak ltr">(أعلى: {peakRx}M)</small>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-dot dot-bad" />
          <span className="chart-stat-label">رفع حالي:</span>
          <strong className="chart-stat-val ltr">{currentTx} Mbps</strong>
          <small className="chart-stat-peak ltr">(أعلى: {peakTx}M)</small>
        </div>
      </div>

      <div className="chart-box">
        <div className="chart-y ltr">
          {[...gridFractions].reverse().map((f) => (
            <span key={f}>{Math.round(max * f)}</span>
          ))}
        </div>

        <div
          className="chart-plot"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const rel = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            setHover(n <= 1 ? 0 : Math.round(rel * (n - 1)));
          }}
          onMouseLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="الصبيب الحي">
            <defs>
              <linearGradient id="rx-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--ok)" stopOpacity="0.28" />
                <stop offset="60%" stopColor="var(--ok)" stopOpacity="0.08" />
                <stop offset="100%" stopColor="var(--ok)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="tx-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--bad)" stopOpacity="0.25" />
                <stop offset="70%" stopColor="var(--bad)" stopOpacity="0.05" />
                <stop offset="100%" stopColor="var(--bad)" stopOpacity="0.0" />
              </linearGradient>
              <filter id="neon-glow-rx" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="var(--ok)" floodOpacity="0.45" />
              </filter>
              <filter id="neon-glow-tx" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="var(--bad)" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* Grid lines with soft dash */}
            {gridFractions.map((f) => (
              <line
                key={f}
                x1="0"
                x2={W}
                y1={H - PAD - f * (H - PAD * 2)}
                y2={H - PAD - f * (H - PAD * 2)}
                stroke="var(--line)"
                strokeDasharray="4 4"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Area gradients */}
            {showRx && n > 1 && <path d={areaRx} fill="url(#rx-grad)" />}
            {showTx && n > 1 && <path d={areaTx} fill="url(#tx-grad)" />}

            {/* Stroke lines with glow */}
            {showRx && (
              <path
                d={path("rx")}
                fill="none"
                stroke="var(--ok)"
                strokeWidth="2.5"
                filter="url(#neon-glow-rx)"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {showTx && (
              <path
                d={path("tx")}
                fill="none"
                stroke="var(--bad)"
                strokeWidth="2.2"
                filter="url(#neon-glow-tx)"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Live pulsating end dots */}
            {showRx && n > 0 && (
              <circle
                cx={x(n - 1)}
                cy={y(data[n - 1].rx)}
                r="4.5"
                fill="var(--ok)"
                stroke="var(--surface)"
                strokeWidth="2"
                className="live-dot-pulse"
              />
            )}
            {showTx && n > 0 && (
              <circle
                cx={x(n - 1)}
                cy={y(data[n - 1].tx)}
                r="4"
                fill="var(--bad)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
            )}

            {/* Interactive cursor line */}
            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1="0"
                y2={H}
                stroke="var(--accent)"
                strokeDasharray="3 3"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Interactive floating tooltip */}
          {hp && hover !== null && (
            <div
              className="chart-tip modern-glass-tip"
              style={{
                left: `${Math.min(85, Math.max(15, (x(hover) / W) * 100))}%`,
              }}
            >
              <div className="chart-tip-time ltr">🕒 {formatClock(hp.at)}</div>
              {showRx && (
                <div className="chart-tip-row">
                  <span>
                    <i className="dot dot-ok" /> سرعة التحميل
                  </span>
                  <strong className="ltr">{hp.rx} Mbps</strong>
                </div>
              )}
              {showTx && (
                <div className="chart-tip-row">
                  <span>
                    <i className="dot dot-bad" /> سرعة الرفع
                  </span>
                  <strong className="ltr">{hp.tx} Mbps</strong>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="chart-x">
          <span>{formatClock(data[0].at)}</span>
          <span>{formatClock(data[Math.floor((n - 1) / 2)].at)}</span>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>
            {formatClock(data[n - 1].at)} (مباشر)
          </span>
        </div>
      </div>
    </div>
  );
}
