'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function AddDrawer({ title, description, triggerLabel, children }: { title: string; description?: string; triggerLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; document.addEventListener('keydown', onKeyDown); return () => document.removeEventListener('keydown', onKeyDown); }, [open]);
  return <>
    <button type="button" className="tds-primary-button drawer-trigger" onClick={() => setOpen(true)}>+ {triggerLabel}</button>
    {open && <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><aside className="app-drawer" role="dialog" aria-modal="true" aria-label={title}><div className="app-drawer-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="secondary-button drawer-close" onClick={() => setOpen(false)} aria-label="입력 닫기">닫기</button></div><div className="app-drawer-body">{children}</div></aside></div>}
  </>;
}
