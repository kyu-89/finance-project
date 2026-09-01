import type { ReactNode } from 'react';
import { AppShell } from '@/components/nav/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
