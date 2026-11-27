"use client";

import React from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";
import { Header } from "./Header";
import { BentoOverviewView } from "./BentoOverviewView";
import { BentoCableView } from "./BentoCableView";
import { BentoWifiView } from "./BentoWifiView";
import { BentoGatewayView } from "./BentoGatewayView";
import { BentoSecurityView } from "./BentoSecurityView";
import { BentoActivityView } from "./BentoActivityView";
import { DeviceDrawer } from "@/components/dashboard/modals/DeviceDrawer";
import { DeviceModal } from "@/components/dashboard/modals/DeviceModal";
import { RebootModal } from "@/components/dashboard/modals/RebootModal";
import { ProxyModal } from "@/components/dashboard/modals/ProxyModal";
import { LoginView } from "@/components/dashboard/auth/LoginView";

export default function BentoDashboard() {
  const { authed, view, toast } = useDashboard();

  if (!authed) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-[#ECEBF3] text-[#14121F] p-[28px_20px] sm:p-[28px_40px] flex flex-col gap-[22px] max-w-[1440px] mx-auto">
      {/* 1. Bento Header with live navigation tabs */}
      <Header />

      {/* 2. Main Content based on active tab view */}
      <main className="w-full">
        {view === "overview" && <BentoOverviewView />}
        {view === "cable" && <BentoCableView />}
        {view === "wifi" && <BentoWifiView />}
        {view === "gateway" && <BentoGatewayView />}
        {view === "security" && <BentoSecurityView />}
        {view === "activity" && <BentoActivityView />}
      </main>

      {/* 3. Global Modals & Drawers */}
      <DeviceDrawer />
      <DeviceModal />
      <RebootModal />
      <ProxyModal />

      {/* 4. Floating Bento Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#14121F] text-white px-6 py-3 rounded-full text-[13px] font-[800] shadow-2xl border border-white/10 flex items-center gap-2 pointer-events-none transition-all">
          <span className="w-2 h-2 rounded-full bg-[#D7F25C] animate-live-dot" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
