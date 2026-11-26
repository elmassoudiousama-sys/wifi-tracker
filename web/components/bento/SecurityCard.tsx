"use client";

import React from "react";

interface SecurityCardProps {
  percentage: number;
  title: string;
  description: string;
  unregisteredCount: number;
}

export function SecurityCard({
  percentage,
  title,
  description,
  unregisteredCount,
}: SecurityCardProps) {
  return (
    <div className="bento-card bg-[#14121F] text-white flex flex-col justify-between">
      {/* Top Section: Shield Icon + 100% + Title + DHCP Info */}
      <div>
        {/* Lime Shield Check Icon 44px */}
        <div className="w-11 h-11 text-[#D7F25C] mb-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-full h-full"
            aria-label="أيقونة أمان الشبكة"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        {/* Giant 100% in Lime */}
        <div className="mb-2">
          <span className="text-[56px] font-[900] leading-none text-[#D7F25C] ltr-num tracking-tight">
            {percentage}%
          </span>
        </div>

        {/* Title */}
        <h2 className="text-[18px] font-[800] text-white mb-1.5">{title}</h2>

        {/* Description */}
        <p className="text-[13px] font-[600] text-white/70 leading-relaxed ltr-num">
          {description}
        </p>
      </div>

      {/* Bottom Alert Box in #2A2740 */}
      <div className="bg-[#2A2740] rounded-[18px] p-4 mt-6 flex items-center justify-between text-[13px] font-[700] text-white/90">
        <span>⚠ {unregisteredCount} أجهزة جديدة غير مسجلة</span>
        <button
          type="button"
          className="text-[#D7F25C] font-[800] hover:underline flex-shrink-0 mr-2"
        >
          مراجعة
        </button>
      </div>
    </div>
  );
}
