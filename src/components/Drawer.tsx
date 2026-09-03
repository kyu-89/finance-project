'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Toast } from './Toast';

// 2026-09(사용자 지시): "저장 버튼 누르고 저장 완료되면 토스트 띄우고 창 닫히게" — 안의 폼이
// 저장 성공을 이 컨텍스트로 알리면(notifySuccess) 드로워가 즉시 닫히고, 토스트는 드로워 밖(항상
// 살아있는 AddDrawer 자신)에서 띄운다. 폼이 드로워 안에서만 렌더되는 자식이라 드로워가 닫히면
// 자식과 함께 사라지는 토스트를 여기서 방지한다.
type DrawerControls = { close: () => void; notifySuccess: (message: string) => void };
const DrawerContext = createContext<DrawerControls>({ close: () => {}, notifySuccess: () => {} });
export function useDrawerControls(): DrawerControls {
  return useContext(DrawerContext);
}

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
  const [toast, setToast] = useState<{ key: number; message: string } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const titleId = `drawer-title-${title.replace(/[^a-zA-Z0-9가-힣]/g, '-')}`;

  const close = useCallback(() => setOpen(false), []);
  // 매번 새 key를 줘서, 연달아 저장했을 때 메시지 문자열이 같아도(예: "지출 내역을 추가했어요.")
  // Toast가 매번 새 인스턴스로 마운트되어 다시 보인다(문자열만 비교하면 두 번째 토스트가 "이미
  // 닫은 메시지"로 취급돼 안 뜬다).
  const notifySuccess = useCallback((message: string) => {
    setToast({ key: Date.now(), message });
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) triggerRef.current?.focus();
      return;
    }

    wasOpenRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === 'Tab') {
        const drawer = document.querySelector<HTMLElement>('.app-drawer');
        if (!drawer) return;
        const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
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
        {triggerLabel}
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
            <div className="app-drawer-body">
              <DrawerContext.Provider value={{ close, notifySuccess }}>{children}</DrawerContext.Provider>
            </div>
          </aside>
        </div>
      )}
      {toast && <Toast key={toast.key} message={toast.message} />}
    </>
  );
}
