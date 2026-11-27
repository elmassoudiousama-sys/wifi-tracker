"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { DashboardIcon as Icon } from "@/components/dashboard/DashboardIcon";

export function LoginView() {
  const { password, setPassword, authError, handleLogin } = useDashboard();

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
          <span className="bg-[#D7F25C] text-[#14121F] text-[11px] font-[900] px-3 py-1 rounded-[999px]">
            محمي
          </span>
        </div>

        <p className="text-[13px] font-[600] text-[#6B6880] leading-relaxed">
          أدخل كلمة السر (ADMIN_PASSWORD) لعرض الأجهزة المتصلة والتحكم في الراوتر.
        </p>

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
            <div className="bg-[#FFF1EA] text-[#FF7A45] text-[12px] font-[800] px-3.5 py-2 rounded-[12px]">
              {authError}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-[#14121F] hover:bg-[#5B3DF5] text-white font-[900] text-[14px] py-3 rounded-[999px] transition-colors"
          >
            دخول للوحة التحكم
          </button>
        </form>
      </div>
    </div>
  );
}
