"use client";

import React from "react";

interface DisconnectedCardProps {
  count: number;
  names: string[];
}

export function DisconnectedCard({ count, names }: DisconnectedCardProps) {
  return (
    <div className="bento-card bg-[#FF7A45] text-white flex items-center justify-between">
      {/* Right / Start (RTL): Label & Device Names */}
      <div>
        <span className="text-[16px] font-[800] block mb-1">
          منقطعة · يتطلب فحص
        </span>
        <span className="text-[14px] font-[700] text-white/90 ltr-num">
          {names.join(" · ")}
        </span>
      </div>

      {/* Left / End (RTL): Giant number 2 */}
      <div>
        <span className="text-[64px] font-[900] leading-none ltr-num tracking-tight">
          {count}
        </span>
      </div>
    </div>
  );
}
