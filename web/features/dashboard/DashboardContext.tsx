"use client";

import { createContext, useContext } from "react";
import type { DashboardContextType } from "./useDashboardState";

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({
  value,
  children,
}: {
  value: DashboardContextType;
  children: React.ReactNode;
}) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextType {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("Dashboard components must be rendered inside DashboardProvider.");
  }
  return context;
}

export function useOptionalDashboard(): DashboardContextType | null {
  return useContext(DashboardContext);
}
