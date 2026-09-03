'use client';

import { useActionState } from 'react';
import { createInsuranceAction, endInsuranceAction } from '@/actions/finance-product-actions';
import { Amount } from '@/components/Amount';
import { AmountInput } from '@/components/AmountInput';
import { AssetItem } from '@/components/AssetItem';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { AddDrawer } from '@/components/Drawer';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Insurance } from '@/lib/insurances';
import type { PaymentMethod } from '@/lib/payment-methods';

export function InsuranceManagerDrawer({ insurances, paymentMethods, today }: { insurances: Insurance[]; paymentMethods: PaymentMethod[]; today: string }) {
  return <div className="flex flex-col gap-5"><div className="flex items-start justify-between gap-3"><p className="min-w-0 rounded-xl bg-[var(--tds-blue-50)] p-4 text-sm">보험료를 입력하면 납입만기까지의 예정 거래를 자동으로 만들어요.</p><AddDrawer title="보험 추가" description="보험료와 보장 기간을 등록해요." triggerLabel="보험 추가"><InsuranceForm paymentMethods={paymentMethods} /></AddDrawer></div><div className="grid min-w-0 gap-4 md:grid-cols-2">{insurances.length === 0 ? <p className="tds-card p-6 text-sm text-[var(--tds-grey-500)]">등록한 보험이 없어요.</p> : insurances.map((item) => <InsuranceRow key={item.id} item={item} today={today} />)}</div></div>;
}

function InsuranceForm({ paymentMethods }: { paymentMethods: PaymentMethod[] }) {
  const [state, action, pending] = useActionState(createInsuranceAction, INITIAL_ACTION_STATE);
  return <form action={action} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><FormMessage result={state} /></div><Field label="보험사"><input name="insurerName" required placeholder="예: 삼성화재" /></Field><Field label="보험 종류"><input name="insuranceType" required placeholder="예: 실손, 종신" /></Field><Field label="보험명"><input name="productName" required placeholder="상품명을 입력하세요" /></Field><Field label="월 보험료"><AmountInput name="monthlyPremium" required placeholder="0" /></Field><Field label="가입일"><input name="joinedAt" type="date" required /></Field><Field label="납입 만기일"><input name="paymentMaturityDate" type="date" /></Field><Field label="보장 만기일"><input name="coverageMaturityDate" type="date" /></Field><Field label="납입일"><input name="paymentDay" type="number" min="1" max="31" placeholder="매월 일자" /></Field><Field label="결제 수단"><select name="paymentMethodId"><option value="">선택 안 함</option>{paymentMethods.filter((method) => method.isActive).map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></Field><Field label="보장 내역"><input name="coverageSummary" placeholder="보장 내역 (선택)" /></Field><Field label="연락처"><input name="contact" placeholder="연락처 (선택)" /></Field><button disabled={pending} className="tds-primary-button md:col-span-2">{pending ? '저장 중…' : '보험 추가'}</button></form>;
}

function InsuranceRow({ item, today }: { item: Insurance; today: string }) {
  const [state, action, pending] = useActionState(endInsuranceAction, INITIAL_ACTION_STATE);
  const active = item.status === 'active';
  const maturity = [item.paymentMaturityDate ? { label: '납입 만기', date: item.paymentMaturityDate } : null, item.coverageMaturityDate ? { label: '보장 만기', date: item.coverageMaturityDate } : null].filter((value): value is { label: string; date: string } => Boolean(value)).map((value) => ({ ...value, days: Math.ceil((Date.parse(`${value.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) })).filter((value) => value.days >= 0 && value.days <= 90).sort((a, b) => a.days - b.days)[0];
  return <AssetItem
    headingLevel={2}
    title={item.productName}
    subtitle={`${item.insurerName} · ${item.insuranceType}`}
    statusBadge={<Badge variant={active ? 'positive' : 'neutral'}>{active ? '유지 중' : item.status === 'free' ? '납입 완료' : '해지'}</Badge>}
    banner={active && maturity ? <Badge variant="warning">{maturity.label} {maturity.days === 0 ? '오늘' : `${maturity.days}일 후`}</Badge> : undefined}
    primaryLabel="월 보험료"
    primaryValue={<Amount value={item.monthlyPremium} size="medium" />}
    primaryNote={item.paymentDay ? `매월 ${item.paymentDay}일` : undefined}
    footnote={<>
      {item.coverageSummary && <p className="tds-asset-item-callout">{item.coverageSummary}</p>}
      <p className="tds-asset-item-footnote">납입 만기 {item.paymentMaturityDate ?? '-'} · 보장 만기 {item.coverageMaturityDate ?? '-'}</p>
    </>}
    dimmed={!active}
    actions={active && <>
      <form action={action} className="grid grid-cols-2 gap-2"><input type="hidden" name="id" value={item.id} /><Button type="submit" variant="secondary" name="status" value="free" disabled={pending}>납입 완료</Button><ConfirmSubmitButton name="status" value="terminated" disabled={pending} className="tds-button-secondary tds-button-danger" title="보험을 해지할까요?" description="해지 처리한 보험은 유지 중 목록에서 제외됩니다." confirmLabel="해지">해지</ConfirmSubmitButton></form>
      <FormMessage result={state} />
    </>}
  />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <FormField label={label} className="min-w-0">{children}</FormField>; }
