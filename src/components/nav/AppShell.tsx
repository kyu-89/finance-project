import type { ReactNode } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNav } from './MobileBottomNav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--tds-grey-50)]">
      <DesktopSidebar />
      <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
