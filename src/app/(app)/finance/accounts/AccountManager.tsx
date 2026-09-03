'use client';

import { useActionState, useState } from 'react';
import { closeAccountAction, createAccountAction, updateAccountBalanceAction } from '@/actions/account-actions';
import { Amount } from '@/components/Amount';
import { AmountInput } from '@/components/AmountInput';
import { AssetItem } from '@/components/AssetItem';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { AddDrawer } from '@/components/Drawer';
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Account } from '@/lib/accounts';
import { maskAccountNumber } from '@/lib/mask';
import { AccountEditDrawer } from './AccountEditDrawer';

const accountTypeName: Record<Account['accountType'], string> = { checking: '입출금', savings: '저축', cma: 'CMA', other: '기타' };
// §9: 상단의 단일 설명 문구를 계좌 종류별 섹션으로 나눈다. 최종 종류는 accounts 테이블의
// account_type CHECK 제약(checking/savings/cma/other)을 그대로 따른다 — '저축'은 삭제 요청이
// 있었으나 이미 등록된 실사용 계좌가 있어 유지하기로 확정했다(사용자 지시).
const SECTIONS: { type: Account['accountType']; description: string }[] = [
  { type: 'checking', description: '입출금 계좌의 현재 잔액을 관리해요.' },
  { type: 'savings', description: '저축 계좌의 현재 잔액을 관리해요.' },
  { type: 'cma', description: 'CMA의 현재 잔액을 관리해요.' },
  { type: 'other', description: '기타 금융계좌의 현재 잔액을 관리해요.' },
];

export function AccountManager({ accounts }: { accounts: Account[] }) {
  const [editing, setEditing] = useState<Account | null>(null);
  return <div className="flex flex-col gap-8">
    {SECTIONS.map(({ type, description }) => {
      const sectionAccounts = accounts.filter((account) => account.accountType === type);
      const label = accountTypeName[type];
      return <section key={type} className="flex flex-col gap-4">
        <Section title={label} description={description}>
          <AddDrawer title={`${label} 계좌 추가`} description="보유 중인 계좌의 정보를 등록하세요." triggerLabel="계좌 추가">
            <CreateAccountForm initialAccountType={type} />
          </AddDrawer>
        </Section>
        {sectionAccounts.length === 0
          ? <p className="rounded-xl border border-dashed border-[var(--tds-grey-300)] p-5 text-sm text-[var(--tds-grey-600)]">등록된 {label} 계좌가 없어요. 위의 계좌 추가로 등록해 보세요.</p>
          : <div className="grid gap-3 md:grid-cols-2">{sectionAccounts.map((account) => <AccountRow key={account.id} account={account} onEdit={() => setEditing(account)} />)}</div>}
      </section>;
    })}
    {editing && <AccountEditDrawer key={editing.id} account={editing} onClose={() => setEditing(null)} />}
  </div>;
}

function CreateAccountForm({ initialAccountType }: { initialAccountType: Account['accountType'] }) {
  const [accountState, createAccountForm, accountPending] = useActionState(createAccountAction, INITIAL_ACTION_STATE);
  return <form action={createAccountForm} className="grid gap-4 md:grid-cols-2">
    <FormMessage result={accountState} />
    <Field label="은행명"><input name="bankName" required placeholder="예: 신한은행" /></Field>
    <Field label="계좌명"><input name="accountName" required placeholder="예: 생활비 통장" /></Field>
    <Field label="종류"><select name="accountType" defaultValue={initialAccountType}>{Object.entries(accountTypeName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="현재 금액"><AmountInput name="currentBalance" defaultValue="0" required placeholder="0" /></Field>
    <Field label="계좌번호"><input name="accountNumber" inputMode="numeric" placeholder="계좌번호" /></Field>
    <Field label="용도"><input name="purpose" placeholder="예: 생활비" /></Field>
    <Field label="비고"><input name="memo" placeholder="메모 (선택)" /></Field>
    <button disabled={accountPending} className="tds-primary-button md:col-span-2">{accountPending ? '저장 중...' : '계좌 추가'}</button>
  </form>;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <><div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">{description}</p></div><div className="flex justify-end">{children}</div></>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <FormField label={label}>{children}</FormField>; }
function AccountRow({ account, onEdit }: { account: Account; onEdit: () => void }) {
  const [balanceState, balanceAction, balancePending] = useActionState(updateAccountBalanceAction, INITIAL_ACTION_STATE);
  const [closeState, closeAction, closePending] = useActionState(closeAccountAction, INITIAL_ACTION_STATE);
  const closed = account.status === 'closed';
  return <AssetItem
    title={account.accountName}
    subtitle={`${account.bankName}${account.accountNumber ? ` · ${maskAccountNumber(account.accountNumber)}` : ''}`}
    statusBadge={<Badge variant={closed ? 'neutral' : 'positive'}>{closed ? '해지' : accountTypeName[account.accountType]}</Badge>}
    primaryLabel="현재 잔액"
    primaryValue={<Amount value={account.currentBalance} size="medium" />}
    dimmed={closed}
    actions={!closed && <>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <form action={balanceAction} className="flex gap-2"><input type="hidden" name="id" value={account.id} /><AmountInput name="amount" defaultValue={account.currentBalance} required className="min-w-0 flex-1 text-right" placeholder="잔액" /><Button type="submit" variant="secondary" disabled={balancePending}>{balancePending ? '수정 중...' : '잔액 수정'}</Button></form>
        <Button type="button" variant="secondary" onClick={onEdit}>정보 수정</Button>
        <form action={closeAction}><input type="hidden" name="id" value={account.id} /><ConfirmSubmitButton disabled={closePending} className="tds-button-secondary tds-button-danger w-full" title="계좌를 해지할까요?" description="해지한 계좌는 목록에서 더 이상 사용할 수 없습니다." confirmLabel="계좌 해지">계좌 해지</ConfirmSubmitButton></form>
      </div>
      <FormMessage result={balanceState.ok !== null ? balanceState : closeState} />
    </>}
  />;
}
