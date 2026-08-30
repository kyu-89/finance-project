'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function AddDrawer({
  title,
  description,
  triggerLabel,
  children,
}: {
  title: string;
  description?: string;
  triggerLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `drawer-title-${title.replace(/[^a-zA-Z0-9가-힣]/g, '-')}`;

  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" className="tds-primary-button drawer-trigger" onClick={() => setOpen(true)}>
        + {triggerLabel}
      </button>
      {open && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <aside className="app-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="app-drawer-header">
              <div>
                <h2 id={titleId}>{title}</h2>
                {description && <p>{description}</p>}
              </div>
              <button ref={closeRef} type="button" className="secondary-button drawer-close" onClick={() => setOpen(false)} aria-label="입력 창 닫기">
                닫기
              </button>
            </div>
            <div className="app-drawer-body">{children}</div>
          </aside>
        </div>
      )}
    </>
  );
}
