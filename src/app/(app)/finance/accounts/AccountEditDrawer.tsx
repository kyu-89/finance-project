'use client';

import { useActionState } from 'react';
import { updateAccountAction } from '@/actions/account-actions';
import { AmountInput } from '@/components/AmountInput';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Account } from '@/lib/accounts';

const ACCOUNT_TYPE_LABEL: Record<Account['accountType'], string> = { checking: '입출금', savings: '저축', cma: 'CMA', other: '기타' };

// §7: 이미 등록된 계좌의 은행명·계좌명·종류·현재 잔액·계좌번호·용도·메모를 별도 드로워에서
// 수정한다. 신규 등록 폼(AccountManager의 CreateAccountForm)과 같은 필수값·검증을 쓰고,
// updateAccountAction이 id로 기존 행을 UPDATE만 하므로 거래의 account_id 참조는 그대로다.
export function AccountEditDrawer({ account, onClose }: { account: Account; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateAccountAction, INITIAL_ACTION_STATE);

  return <div className="drawer-backdrop fixed inset-0 z-50" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="app-drawer ml-auto flex h-full flex-col overflow-y-auto" role="dialog" aria-modal="true" aria-label="계좌 수정">
      <div className="app-drawer-header flex items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-[var(--tds-blue-600)]">계좌 수정</p><h2 className="mt-1 text-xl font-bold">{account.accountName}</h2></div>
        <Button type="button" variant="ghost" onClick={onClose} className="px-3" aria-label="계좌 수정 닫기">닫기</Button>
      </div>
      <div className="app-drawer-body"><form action={action} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="id" value={account.id} />
        <FormMessage result={state} />
        <FormField label="은행명" required><input name="bankName" defaultValue={account.bankName} required placeholder="예: 신한은행" /></FormField>
        <FormField label="계좌명" required><input name="accountName" defaultValue={account.accountName} required placeholder="예: 생활비 통장" /></FormField>
        <FormField label="종류" required><select name="accountType" defaultValue={account.accountType}>{Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
        <FormField label="현재 금액" required><AmountInput name="currentBalance" defaultValue={account.currentBalance} required placeholder="0" /></FormField>
        <FormField label="계좌번호"><input name="accountNumber" defaultValue={account.accountNumber ?? ''} inputMode="numeric" placeholder="계좌번호" /></FormField>
        <FormField label="용도"><input name="purpose" defaultValue={account.purpose ?? ''} placeholder="예: 생활비" /></FormField>
        <FormField label="비고" className="md:col-span-2"><input name="memo" defaultValue={account.memo ?? ''} placeholder="메모 (선택)" /></FormField>
        <Button type="submit" variant="primary" disabled={pending} className="md:col-span-2">{pending ? '저장 중...' : '변경사항 저장'}</Button>
      </form></div>
    </aside>
  </div>;
}
