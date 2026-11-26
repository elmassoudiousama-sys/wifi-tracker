import type { Metadata } from "next";
import { MapEditor } from "@/components/map-editor/MapEditor";

export const metadata: Metadata = {
  title: "تعديل الخريطة | مراقبة الشبكة",
  description: "محرر خريطة الشبكة والطوبولوجيا ومسارات الكوابل والسويتشات",
};

export default function MapPage() {
  return <MapEditor />;
}
