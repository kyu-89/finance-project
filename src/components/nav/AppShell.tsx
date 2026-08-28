import type { ReactNode } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNav } from './MobileBottomNav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <DesktopSidebar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
