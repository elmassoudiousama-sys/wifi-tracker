"use client";

import React from "react";

interface RingGaugeProps {
  value: number;
  max: number;
  color: string;
  label: string;
}

export function Ring({ value, max, color, label }: RingGaugeProps) {
  const size = 120;
  const radius = 46;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(1, Math.max(0, value / max));
  const strokeDashoffset = circumference * (1 - fraction);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[120px] h-[120px]">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 overflow-visible"
          aria-label={`${label}: ${value} ms`}
        >
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#EEF0F5"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress Stroke */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>

        {/* Value in Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[22px] font-[800] text-[#14121F] leading-none ltr-num">
            {value.toFixed(value < 10 ? 2 : 1)}
          </span>
          <span className="text-[12px] font-[600] text-[#6B6880] mt-0.5">
            ms
          </span>
        </div>
      </div>

      <span className="text-[13px] font-[700] text-[#14121F] mt-2.5">
        {label}
      </span>
    </div>
  );
}

interface LatencyCardProps {
  routerMs: number;
  routerMaxMs: number;
  wanMs: number;
  wanMaxMs: number;
  badge: string;
  fiberStatus: string;
}

export function LatencyCard({
  routerMs,
  routerMaxMs,
  wanMs,
  wanMaxMs,
  badge,
  fiberStatus,
}: LatencyCardProps) {
  return (
    <div className="bento-card bg-white text-[#14121F] flex flex-col justify-between">
      {/* Header with Title and Green Badge */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-[800]">زمن الاستجابة</h2>
        <span className="bg-[#E5F8D0] text-[#2F6B0F] text-[12px] font-[800] px-3 py-1 rounded-[999px]">
          {badge}
        </span>
      </div>

      {/* Two Ring Gauges: Router & WAN */}
      <div className="flex items-center justify-around py-3">
        <Ring
          value={routerMs}
          max={routerMaxMs}
          color="#5B3DF5"
          label="راوتر (Router)"
        />
        <Ring
          value={wanMs}
          max={wanMaxMs}
          color="#FF7A45"
          label="إنترنت (WAN)"
        />
      </div>

      {/* Grey row: حالة الفايبر — ممتاز */}
      <div className="bg-[#F6F6FA] rounded-[16px] px-4 py-3 flex items-center justify-between text-[13px] font-[700] mt-4 mb-4">
        <span className="text-[#6B6880]">حالة الفايبر</span>
        <span className="text-[#2F6B0F] font-[800]">
          — {fiberStatus}
        </span>
      </div>

      {/* Outline Pill Button */}
      <button
        type="button"
        className="btn-outline w-full h-[46px] rounded-[999px] font-[800] text-[14px] flex items-center justify-center transition-colors"
      >
        إعادة تشغيل الراوتر
      </button>
    </div>
  );
}
