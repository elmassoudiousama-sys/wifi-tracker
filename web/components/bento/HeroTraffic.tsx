"use client";

import React from "react";
import { TrafficBar } from "@/lib/data";

interface HeroTrafficProps {
  currentDownload: number;
  peakDownload: number;
  currentUpload: number;
  peakUpload: number;
  bars: TrafficBar[];
  timeLabels: string[];
}

export function HeroTraffic({
  currentDownload,
  peakDownload,
  currentUpload,
  peakUpload,
  bars,
  timeLabels,
}: HeroTrafficProps) {
  const totalSlots = 44;
  const svgWidth = 900;
  const svgHeight = 260;
  const baselineY = 193;
  const maxDlHeight = 170;
  const maxUlHeight = 58;
  const slotWidth = svgWidth / totalSlots;
  const barWidth = 12;

  return (
    <div className="bento-card bg-[#5B3DF5] text-white flex flex-col justify-between overflow-hidden">
      {/* Top Header & Big Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        {/* Download Stat */}
        <div>
          <span className="text-white/80 text-[14px] font-[700] block mb-1">
            رادار الصبيب الحي
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[64px] font-[900] leading-none ltr-num tracking-tight">
              {currentDownload.toFixed(2)}
            </span>
            <span className="text-[18px] font-[700] text-white/80">Mbps</span>
          </div>
          <p className="text-[13px] font-[600] text-white/80 mt-1">
            تحميل حالي · الذروة <span className="ltr-num font-[700]">{peakDownload.toFixed(2)}</span>
          </p>
        </div>

        {/* Upload Stat (Opposite side) */}
        <div className="sm:text-left text-right">
          <span className="text-[#FFB59B] text-[14px] font-[700] block mb-1">
            رفع
          </span>
          <div className="flex items-baseline sm:justify-start gap-1.5 text-[#FFB59B]">
            <span className="text-[40px] font-[900] leading-none ltr-num">
              {currentUpload.toFixed(2)}
            </span>
            <span className="text-[16px] font-[700]">Mbps</span>
          </div>
          <p className="text-[13px] font-[600] text-[#FFB59B]/90 mt-1">
            الذروة <span className="ltr-num font-[700]">{peakUpload.toFixed(2)}</span>
          </p>
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div className="mt-6 mb-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          className="w-full h-[270px] overflow-visible"
          aria-label="مبيان شريطي لصبيب التحميل والرفع لحظة بلحظة"
        >
          {/* Baseline at y = 193 */}
          <line
            x1="0"
            y1={baselineY}
            x2={svgWidth}
            y2={baselineY}
            stroke="white"
            strokeOpacity="0.3"
            strokeWidth="1"
          />

          {bars.slice(0, totalSlots).map((bar, i) => {
            const isLive = i === bars.length - 1;
            const x = i * slotWidth + (slotWidth - barWidth) / 2;

            // Download bar (goes UP from baseline 193)
            const dlHeight = Math.max(4, Math.min(maxDlHeight, (bar.download / 50) * maxDlHeight));
            const dlY = baselineY - dlHeight;
            const dlOpacity = isLive ? 1 : 0.35 + (i / totalSlots) * 0.5;
            const dlFill = isLive ? "#D7F25C" : "#FFFFFF";

            // Upload bar (goes DOWN from baseline 193)
            const ulHeight = Math.max(3, Math.min(maxUlHeight, (bar.upload / 5) * maxUlHeight));
            const ulY = baselineY;
            const ulOpacity = isLive ? 1 : 0.5 + (i / totalSlots) * 0.4;
            const ulFill = "#FF9F7A";

            return (
              <g key={i}>
                {/* Download bar */}
                <rect
                  x={x}
                  y={dlY}
                  width={barWidth}
                  height={dlHeight}
                  rx={4}
                  fill={dlFill}
                  fillOpacity={dlOpacity}
                />
                {/* Upload bar */}
                <rect
                  x={x}
                  y={ulY}
                  width={barWidth}
                  height={ulHeight}
                  rx={3}
                  fill={ulFill}
                  fillOpacity={ulOpacity}
                />
              </g>
            );
          })}
        </svg>

        {/* Time labels under the chart (aligned with LTR time progression in SVG) */}
        <div dir="ltr" className="flex items-center justify-between text-[12px] font-[700] text-white/70 mt-3 px-1">
          <span className="ltr-num">{timeLabels[0] || "22:53:34"}</span>
          <span className="ltr-num">{timeLabels[1] || "23:03:23"}</span>
          <span className="ltr-num text-[#D7F25C] font-[800]">
            {timeLabels[2] || "23:14:35 · مباشر"}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-2 pt-3 border-t border-white/10 text-[13px] font-[700]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-[3px] bg-white inline-block" />
          <span>تحميل ↑</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-[3px] bg-[#FF9F7A] inline-block" />
          <span className="text-[#FFB59B]">رفع ↓</span>
        </div>
      </div>
    </div>
  );
}
