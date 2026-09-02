import type { Metadata } from "next";
import "./globals.css";
import "./design-system.css";

export const metadata: Metadata = {
  title: { default: "우리집 재무", template: "%s | 우리집 재무" },
  description: "우리 집 돈의 흐름과 자산의 변화를 한눈에 보는 가정 재무관리 서비스.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
