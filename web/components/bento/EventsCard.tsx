"use client";

import React from "react";
import { NetworkEvent } from "@/lib/data";

interface EventsCardProps {
  events: NetworkEvent[];
}

export function EventsCard({ events }: EventsCardProps) {
  return (
    <div className="bento-card bg-white text-[#14121F] flex flex-col justify-between">
      {/* Header: Title + Outline button */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[18px] font-[800]">شريط الأحداث اللحظية</h2>
        <button
          type="button"
          className="btn-outline px-4 py-2 rounded-[999px] text-[12px] font-[800] transition-colors"
        >
          عرض السجل الكامل
        </button>
      </div>

      {/* Events List */}
      <div className="divide-y divide-[#EEF0F5]">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="py-3.5 flex items-center justify-between gap-4 first:pt-2 last:pb-1"
          >
            {/* Right / Start (RTL): Orange dot + Device & Info */}
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF7A45] mt-1.5 flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-[800] text-[#14121F]">
                    {ev.device}
                  </span>
                  <span className="text-[12px] font-[600] text-[#6B6880]">
                    — {ev.tag}
                  </span>
                </div>
                <p className="text-[12px] font-[600] text-[#6B6880] mt-0.5 ltr-num">
                  {ev.ip} · {ev.mac} · {ev.port}
                </p>
              </div>
            </div>

            {/* Left / End (RTL): Event Timestamp */}
            <div className="flex-shrink-0">
              <span className="text-[13px] font-[800] text-[#14121F] ltr-num">
                {ev.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
