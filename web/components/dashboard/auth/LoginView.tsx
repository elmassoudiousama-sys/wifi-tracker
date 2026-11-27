"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";
import { DashboardIcon as Icon } from "@/components/dashboard/DashboardIcon";

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function LoginView() {
  const { password, setPassword, authError, attemptsLeft, lockedUntil, setLockedUntil, handleLogin } =
    useDashboard();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!lockedUntil) return;
    setNowMs(Date.now());
    const id = setInterval(() => {
      const cur = Date.now();
      setNowMs(cur);
      if (cur >= lockedUntil) {
        setLockedUntil(null);
        localStorage.removeItem("fiber_auth_locked_until");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil, setLockedUntil]);

  const remainingMs = lockedUntil ? Math.max(0, lockedUntil - nowMs) : 0;
  const isLocked = remainingMs > 0;

  return (
    <div className="min-h-screen bg-[#ECEBF3] text-[#14121F] flex items-center justify-center p-5">
      <div className="w-full max-w-[400px] bg-white rounded-[28px] p-7 shadow-xl border border-[#14121F]/5 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[16px] bg-[#5B3DF5] text-white flex items-center justify-center shadow-md">
              <Icon name="wifi" size={20} />
            </div>
            <div>
              <h1 className="text-[19px] font-[900] leading-tight">مراقبة الشبكة</h1>
              <span className="text-[12px] font-[700] text-[#6B6880]">ZTE F680 · Fiber Monitor</span>
            </div>
          </div>
          <span
            className={`text-[11px] font-[900] px-3 py-1 rounded-[999px] ${
              isLocked ? "bg-[#FFF1EA] text-[#FF7A45]" : "bg-[#D7F25C] text-[#14121F]"
            }`}
          >
            {isLocked ? "مقفل 24 ساعة" : "محمي (3 محاولات)"}
          </span>
        </div>

        <p className="text-[13px] font-[600] text-[#6B6880] leading-relaxed">
          {isLocked
            ? "تم حظر تسجيل الدخول لمدة 24 ساعة بعد استنفاد 3 محاولات خاطئة."
            : "أدخل كلمة السر لعرض الأجهزة المتصلة والتحكم في الراوتر."}
        </p>

        {isLocked ? (
          <div className="bg-[#14121F] text-white rounded-[20px] p-5 text-center flex flex-col gap-2">
            <span className="text-[12px] font-[700] text-white/70">الوقت المتبقي لإعادة المحاولة</span>
            <span className="text-[32px] font-[900] text-[#D7F25C] ltr-num tracking-wider">
              {formatRemaining(remainingMs)}
            </span>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="password"
              className="w-full bg-[#F6F6FA] border border-[#14121F]/10 focus:border-[#5B3DF5] focus:outline-none rounded-[16px] px-4 py-3 text-[14px] font-[700] ltr-num"
              placeholder="كلمة السر"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
            {authError && (
              <div className="bg-[#FFF1EA] text-[#FF7A45] text-[12px] font-[800] px-3.5 py-2.5 rounded-[12px] flex items-center justify-between gap-2">
                <span>{authError}</span>
                {attemptsLeft !== null && (
                  <span className="bg-white px-2 py-0.5 rounded-[999px] text-[11px] font-[900] ltr-num flex-shrink-0">
                    {attemptsLeft}/3
                  </span>
                )}
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-[#14121F] hover:bg-[#5B3DF5] text-white font-[900] text-[14px] py-3 rounded-[999px] transition-colors"
            >
              دخول للوحة التحكم
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
