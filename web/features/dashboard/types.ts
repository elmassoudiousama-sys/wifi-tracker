export type StatusFilter = "all" | "online" | "offline" | "blocked";
export type SortCol = "status" | "name" | "ip" | "port";
export type SortDir = "asc" | "desc";
export type View = "overview" | "cable" | "wifi" | "gateway" | "security" | "activity";
export type DrawerTab = "info" | "network" | "actions";

export interface HistoryPoint {
  at: string;
  rx: number;
  tx: number;
  online: number;
  offline: number;
  ping: number | null;
}

export interface CableHealthInfo {
  quality: string;
  score: number;
  jitter?: number | null;
  loss?: number;
  avg?: number | null;
  source?: string;
}
