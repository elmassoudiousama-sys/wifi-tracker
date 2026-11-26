import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مراقبة الشبكة | نظرة عامة",
  description: "لوحة مراقبة شبكة راوتر ZTE F680 بتصميم Bento عصري وسريع",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-cairo bg-[#ECEBF3] text-[#14121F] min-h-screen antialiased selection:bg-[#5B3DF5] selection:text-white">
        {children}
      </body>
    </html>
  );
}
