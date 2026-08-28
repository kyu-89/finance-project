import type { ReactNode } from 'react';
import { ensureHouseholdForCurrentUser } from '@/actions/household';
import { AppShell } from '@/components/nav/AppShell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureHouseholdForCurrentUser();

  return <AppShell>{children}</AppShell>;
}
