import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meeting AI Assistant",
  description: "リアルタイム会議支援AIアシスタント — 高松智司・高田貴久の思考フレームワークで会議を分析",
};

// スマホでの表示崩れ防止（ノッチ回避＋ピンチズームは許可）
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-gray-50 dark:bg-gray-950">{children}</body>
    </html>
  );
}
