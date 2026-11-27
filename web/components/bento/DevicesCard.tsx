"use client";

import React from "react";
import { DeviceDot } from "@/lib/data";

interface DevicesCardProps {
  connected: number;
  total: number;
  percent: number;
  dots: DeviceDot[];
  unknownCount?: number;
}

export function DevicesCard({
  connected,
  total,
  percent,
  dots,
  unknownCount = 0,
}: DevicesCardProps) {
  return (
    <div className="bento-card bg-[#D7F25C] text-[#14121F] flex flex-col justify-between flex-1">
      {/* Header: Title + Percent Pill */}
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-[800]">الأجهزة المتصلة</h2>
        <span className="bg-[#14121F] text-[#D7F25C] text-[13px] font-[900] px-3.5 py-1 rounded-[999px] ltr-num">
          {percent}%
        </span>
      </div>

      {/* Giant Number */}
      <div className="my-4">
        <div className="flex items-baseline gap-1">
          <span className="text-[84px] font-[900] leading-none ltr-num tracking-tight">
            {connected}
          </span>
          <span className="text-[28px] font-[800] opacity-55 ltr-num">
            /{total}
          </span>
        </div>
      </div>

      {/* Bottom: 34 dots wrap + legend line */}
      <div>
        <div className="flex flex-wrap gap-2 mb-4" aria-label="خريطة الأجهزة المتصلة">
          {dots.map((dot, idx) => {
            if (dot.type === "connected") {
              return (
                <span
                  key={idx}
                  title="جهاز متصل"
                  className="w-4 h-4 rounded-full bg-[#14121F] inline-block transition-transform hover:scale-125"
                />
              );
            }
            if (dot.type === "disconnected") {
              return (
                <span
                  key={idx}
                  title="جهاز منقطع"
                  className="w-4 h-4 rounded-full bg-[#FF7A45] inline-block transition-transform hover:scale-125"
                />
              );
            }
            if (dot.type === "new") {
              return (
                <span
                  key={idx}
                  title="جهاز جديد"
                  className="w-4 h-4 rounded-full bg-white border border-[#14121F]/20 inline-block transition-transform hover:scale-125"
                />
              );
            }
            // blocked
            return (
              <span
                key={idx}
                title="جهاز محظور"
                className="w-4 h-4 rounded-full bg-[#65771A] inline-block transition-transform hover:scale-125"
              />
            );
          })}
        </div>

        {/* Legend line */}
        <div className="flex items-center gap-4 text-[12px] font-[700] text-[#14121F]/80 flex-wrap border-t border-[#14121F]/10 pt-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#14121F]" />
            <span>متصل</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF7A45]" />
            <span>منقطع</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white border border-[#14121F]/30" />
            <span>جديد ({unknownCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#65771A]" />
            <span>محظور</span>
          </div>
        </div>
      </div>
    </div>
  );
}
