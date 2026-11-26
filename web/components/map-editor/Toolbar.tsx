"use client";

import React from "react";

export type EditorTool = "select" | "pan" | "cable";

interface ToolbarProps {
  currentTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  onUndo: () => void;
  onAutoLayout: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function Toolbar({
  currentTool,
  onSelectTool,
  onUndo,
  onAutoLayout,
  zoom,
  onZoomIn,
  onZoomOut,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border-b border-[#EEF0F5] rounded-t-[24px]">
      {/* Right / Start (RTL): Tool Selection Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onSelectTool("select")}
          title="تحريك وتحديد السويتشات والأجهزة بحرية"
          className={`h-[40px] px-4 rounded-[999px] text-[13px] font-[800] transition-all flex items-center gap-2 cursor-pointer ${
            currentTool === "select"
              ? "bg-[#14121F] text-white shadow-sm"
              : "bg-[#F6F6FA] text-[#14121F] hover:bg-[#EEF0F5]"
          }`}
        >
          <span>↖</span>
          <span>تحريك وتحديد الأجهزة</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTool("pan")}
          title="سحب خلفية الخريطة للتنقل"
          className={`h-[40px] px-4 rounded-[999px] text-[13px] font-[800] transition-all flex items-center gap-2 cursor-pointer ${
            currentTool === "pan"
              ? "bg-[#14121F] text-white shadow-sm"
              : "bg-[#F6F6FA] text-[#14121F] hover:bg-[#EEF0F5]"
          }`}
        >
          <span>✋</span>
          <span>سحب الشاشة (خلفية)</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTool("cable")}
          title="توصيل كابل بين السويتش والأجهزة بالسحب أو النقر"
          className={`h-[40px] px-4 rounded-[999px] text-[13px] font-[800] transition-all flex items-center gap-2 cursor-pointer ${
            currentTool === "cable"
              ? "bg-[#5B3DF5] text-white shadow-sm"
              : "bg-[#F6F6FA] text-[#14121F] hover:bg-[#EEF0F5]"
          }`}
        >
          <span>⚡</span>
          <span>وصل كابل</span>
        </button>
      </div>

      {/* Left / End (RTL): Undo | Auto Layout | Zoom Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onUndo}
          title="تراجع عن آخر حركة"
          className="h-[40px] px-3.5 bg-[#F6F6FA] hover:bg-[#EEF0F5] text-[#14121F] rounded-[999px] text-[12px] font-[800] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>↩</span>
          <span>تراجع</span>
        </button>

        <button
          type="button"
          onClick={onAutoLayout}
          title="ترتيب العناصر تلقائياً"
          className="h-[40px] px-3.5 bg-[#F6F6FA] hover:bg-[#EEF0F5] text-[#14121F] rounded-[999px] text-[12px] font-[800] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>✨</span>
          <span>ترتيب تلقائي</span>
        </button>

        <div className="h-6 w-px bg-[#EEF0F5] mx-1" />

        {/* Zoom Controls: "− 100% +" */}
        <div className="flex items-center bg-[#F6F6FA] rounded-[999px] p-0.5 border border-[#EEF0F5]">
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="تصغير الخريطة"
            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-[16px] text-[#6B6880] hover:text-[#14121F] hover:bg-white transition-all cursor-pointer"
          >
            −
          </button>
          <span className="text-[12px] font-[800] px-2 text-[#14121F] select-none ltr-num">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="تكبير الخريطة"
            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-[16px] text-[#6B6880] hover:text-[#14121F] hover:bg-white transition-all cursor-pointer"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
