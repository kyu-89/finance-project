import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리집 가계부",
  description:
    "수입·지출·예산·자산을 하나로 통합해, 모바일에서 빠르게 기록하고 PC에서 깊게 분석하는 개인 재무관리 웹 서비스.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
