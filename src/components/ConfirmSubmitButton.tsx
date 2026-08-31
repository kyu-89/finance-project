'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  children: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
};

export function ConfirmSubmitButton({ children, title, description, confirmLabel = '확인', className, name, value, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const confirmedRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]');
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function requestSubmit(event: React.MouseEvent<HTMLButtonElement>) {
    if (confirmedRef.current) {
      confirmedRef.current = false;
      return;
    }
    event.preventDefault();
    setOpen(true);
  }

  function confirm() {
    const form = buttonRef.current?.form;
    confirmedRef.current = true;
    setOpen(false);
    if (form && buttonRef.current) form.requestSubmit(buttonRef.current);
  }

  return <>
    <button ref={buttonRef} type="submit" name={name} value={value} disabled={disabled} className={className} onClick={requestSubmit}>{children}</button>
    {open && <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        <div className="confirm-dialog-actions"><button type="button" className="tds-button-secondary" onClick={() => setOpen(false)}>취소</button><button type="button" className="tds-primary-button" onClick={confirm}>{confirmLabel}</button></div>
      </section>
    </div>}
  </>;
}
