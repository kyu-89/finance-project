import type { ReactNode } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNav } from './MobileBottomNav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-[var(--tds-grey-50)]">
      <div className="flex w-full max-w-[var(--app-max-width)]">
        <DesktopSidebar />
        <main className="app-main min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
