"use client";

import React from "react";
import { INITIAL_PALETTE_ITEMS, PaletteItem } from "@/lib/map-data";

interface PaletteProps {
  onDragStartItem?: (item: PaletteItem) => void;
  onAddCustom?: () => void;
}

export function Palette({ onDragStartItem, onAddCustom }: PaletteProps) {
  const handleDragStart = (e: React.DragEvent, item: PaletteItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
    if (onDragStartItem) onDragStartItem(item);
  };

  return (
    <div className="bento-card bg-white text-[#14121F] flex flex-col gap-3">
      <div>
        <h2 className="text-[18px] font-[900] text-[#14121F]">مكتبة الأجهزة</h2>
        <p className="text-[12px] font-[600] text-[#6B6880] mt-0.5">
          اسحب أي عنصر وحطو فين بغيتي فالخريطة
        </p>
      </div>

      {/* 2-column grid of draggable tiles */}
      <div className="grid grid-cols-2 gap-2.5">
        {INITIAL_PALETTE_ITEMS.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            className="bg-[#F6F6FA] hover:bg-[#EEF0F5] border border-transparent hover:border-[#5B3DF5]/30 rounded-[18px] p-2.5 flex flex-col items-center justify-between text-center cursor-grab active:cursor-grabbing transition-all select-none group"
            title={`اسحب ${item.name} إلى الخريطة`}
          >
            {/* Flat SVG Icon preview (150x80 viewBox) */}
            <div className="w-full h-[52px] flex items-center justify-center">
              <svg viewBox="0 0 150 80" className="w-full h-full max-h-[48px]">
                {item.type === "switch" && (
                  <g>
                    {/* Switch Body */}
                    <rect
                      x="20"
                      y="26"
                      width="110"
                      height="28"
                      rx="7"
                      fill="#272B52"
                    />
                    {/* Power LED */}
                    <circle cx="30" cy="40" r="2.5" fill="#34D399" />
                    {/* Ports + LEDs */}
                    {Array.from({ length: Math.min(item.ports || 5, 8) }).map((_, i) => (
                      <g key={i}>
                        <circle
                          cx={42 + i * 11}
                          cy="32"
                          r="1.8"
                          fill={i === 0 ? "#8B6CFF" : i < 4 ? "#34D399" : "#4A507E"}
                        />
                        <rect
                          x={38.5 + i * 11}
                          y="36"
                          width="7"
                          height="10"
                          rx="2"
                          fill="#12153A"
                        />
                      </g>
                    ))}
                  </g>
                )}

                {item.type === "ap" && (
                  <g>
                    <rect
                      x="53"
                      y="18"
                      width="44"
                      height="44"
                      rx="12"
                      fill="#5B3DF5"
                    />
                    {/* White Wi-Fi glyph */}
                    <circle cx="75" cy="48" r="2.5" fill="#FFFFFF" />
                    <path
                      d="M68 42 A10 10 0 0 1 82 42"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M63 36 A17 17 0 0 1 87 36"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                  </g>
                )}

                {item.type === "router" && (
                  <g>
                    {/* Antennas */}
                    <line
                      x1="60"
                      y1="34"
                      x2="50"
                      y2="18"
                      stroke="#5B3DF5"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <line
                      x1="90"
                      y1="34"
                      x2="100"
                      y2="18"
                      stroke="#5B3DF5"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    {/* Body */}
                    <rect
                      x="52"
                      y="32"
                      width="46"
                      height="20"
                      rx="7"
                      fill="#FFFFFF"
                      stroke="#5B3DF5"
                      strokeWidth="3"
                    />
                    {/* Three dots */}
                    <circle cx="65" cy="42" r="2" fill="#5B3DF5" />
                    <circle cx="75" cy="42" r="2" fill="#5B3DF5" />
                    <circle cx="85" cy="42" r="2" fill="#5B3DF5" />
                  </g>
                )}

                {item.type === "camera" && (
                  <g>
                    {/* Base bar */}
                    <rect
                      x="54"
                      y="48"
                      width="42"
                      height="6"
                      rx="3"
                      fill="#5B3DF5"
                    />
                    {/* Dome */}
                    <path
                      d="M58 48 A17 17 0 0 1 92 48 Z"
                      fill="#FFFFFF"
                      stroke="#5B3DF5"
                      strokeWidth="3"
                      strokeLinejoin="round"
                    />
                    {/* Inner lens */}
                    <circle cx="75" cy="41" r="4.5" fill="#5B3DF5" />
                  </g>
                )}
              </svg>
            </div>

            <div className="mt-1">
              <span className="text-[13px] font-[900] text-[#14121F] block group-hover:text-[#5B3DF5] transition-colors">
                {item.name}
              </span>
              <span className="text-[11px] font-[700] text-[#6B6880] block">
                {item.sub}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Dashed "+ جهاز مخصص" Tile */}
      <button
        type="button"
        onClick={onAddCustom}
        className="w-full border-2 border-dashed border-[#5B3DF5]/30 hover:border-[#5B3DF5] bg-[#F6F6FA]/60 hover:bg-[#F6F6FA] rounded-[18px] py-3 text-center cursor-pointer transition-all flex items-center justify-center gap-2"
      >
        <span className="w-5 h-5 rounded-full bg-[#5B3DF5] text-white flex items-center justify-center text-[13px] font-bold">
          +
        </span>
        <span className="text-[13px] font-[800] text-[#5B3DF5]">
          جهاز مخصص
        </span>
      </button>
    </div>
  );
}
