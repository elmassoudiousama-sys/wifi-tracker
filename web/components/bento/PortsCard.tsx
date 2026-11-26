"use client";

import React from "react";
import { LanPort } from "@/lib/data";

interface PortRowProps {
  port: LanPort;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function PortRow({ port, isSelected, onSelect }: PortRowProps) {
  // calculate fill percentage: download / 16 Mbps, min 1.5%
  const percentage = Math.max(1.5, Math.min(100, (port.download / 16) * 100));

  return (
    <div
      onClick={() => onSelect(port.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(port.id);
        }
      }}
      className={`rounded-[18px] p-[14px_18px] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isSelected
          ? "bg-[#FFF1EA] ring-2 ring-[#FF7A45]/30"
          : "bg-[#F6F6FA] hover:bg-[#EEF0F5]"
      }`}
    >
      {/* Right / Start (RTL): Port name & Badge + Bar + Stats */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[16px] font-[800] text-[#14121F] ltr-num">
            {port.name}
          </span>
          {isSelected && (
            <span className="bg-[#FF7A45] text-white text-[11px] font-[800] px-2.5 py-0.5 rounded-[999px]">
              محدد
            </span>
          )}
        </div>

        {/* White Track Bar 14px high with Violet Fill */}
        <div className="w-full bg-white h-[14px] rounded-full overflow-hidden mb-1.5 p-0.5">
          <div
            className="h-full bg-[#5B3DF5] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Subtitle info: ↑ upload Mbps · total GB */}
        <p className="text-[12px] font-[600] text-[#6B6880] ltr-num">
          ↑ {port.upload.toFixed(2)} Mbps · {port.totalGb.toFixed(2)} GB
        </p>
      </div>

      {/* Left / End (RTL): Big download number */}
      <div className="flex items-baseline sm:flex-col sm:items-end justify-end flex-shrink-0">
        <span className="text-[26px] font-[800] text-[#14121F] leading-none ltr-num">
          {port.download.toFixed(2)}
        </span>
        <span className="text-[12px] font-[700] text-[#6B6880] sm:mt-1 mr-1 sm:mr-0">
          Mbps
        </span>
      </div>
    </div>
  );
}

interface PortsCardProps {
  ports: LanPort[];
  selectedPortId: string;
  onSelectPort: (id: string) => void;
}

export function PortsCard({
  ports,
  selectedPortId,
  onSelectPort,
}: PortsCardProps) {
  return (
    <div className="bento-card bg-white text-[#14121F] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-[800] text-[#14121F]">
            استهلاك منافذ LAN
          </h2>
          <p className="text-[13px] font-[600] text-[#6B6880] mt-0.5">
            اضغط على منفذ لعرض أجهزته
          </p>
        </div>
        <span className="bg-[#F6F6FA] text-[#14121F] text-[12px] font-[800] px-3.5 py-1.5 rounded-[999px]">
          4 منافذ
        </span>
      </div>

      {/* 4 Port Rows */}
      <div className="flex flex-col gap-3">
        {ports.map((port) => (
          <PortRow
            key={port.id}
            port={port}
            isSelected={selectedPortId === port.id}
            onSelect={onSelectPort}
          />
        ))}
      </div>
    </div>
  );
}
