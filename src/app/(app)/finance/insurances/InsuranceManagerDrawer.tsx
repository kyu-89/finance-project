'use client';

import { useActionState } from 'react';
import { createInsuranceAction, endInsuranceAction } from '@/actions/finance-product-actions';
import { AddDrawer } from '@/components/Drawer';
import { FormMessage } from '@/components/FormMessage';
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Insurance } from '@/lib/insurances';
import type { PaymentMethod } from '@/lib/payment-methods';

const won = new Intl.NumberFormat('ko-KR');

export function InsuranceManagerDrawer({ insurances, paymentMethods, today }: { insurances: Insurance[]; paymentMethods: PaymentMethod[]; today: string }) {
  return <div className="flex flex-col gap-5"><div className="flex items-start justify-between gap-3"><p className="min-w-0 rounded-xl bg-[var(--tds-blue-50)] p-4 text-sm">보험료를 입력하면 납입만기까지의 예정 거래를 자동으로 만들어요.</p><AddDrawer title="보험 추가" description="보험료와 보장 기간을 등록해요." triggerLabel="보험 추가"><InsuranceForm paymentMethods={paymentMethods} /></AddDrawer></div><div className="grid min-w-0 gap-4 md:grid-cols-2">{insurances.length === 0 ? <p className="tds-card p-6 text-sm text-[var(--tds-grey-500)]">등록한 보험이 없어요.</p> : insurances.map((item) => <InsuranceRow key={item.id} item={item} today={today} />)}</div></div>;
}

function InsuranceForm({ paymentMethods }: { paymentMethods: PaymentMethod[] }) {
  const [state, action, pending] = useActionState(createInsuranceAction, INITIAL_ACTION_STATE);
  return <form action={action} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><FormMessage result={state} /></div><Field label="보험사"><input name="insurerName" required placeholder="예: 삼성화재" /></Field><Field label="보험 종류"><input name="insuranceType" required placeholder="예: 실손, 종신" /></Field><Field label="보험명"><input name="productName" required placeholder="상품명을 입력하세요" /></Field><Field label="월 보험료"><input name="monthlyPremium" type="number" min="0" step="1" required placeholder="0" /></Field><Field label="가입일"><input name="joinedAt" type="date" required /></Field><Field label="납입 만기일"><input name="paymentMaturityDate" type="date" /></Field><Field label="보장 만기일"><input name="coverageMaturityDate" type="date" /></Field><Field label="납입일"><input name="paymentDay" type="number" min="1" max="31" placeholder="매월 일자" /></Field><Field label="결제 수단"><select name="paymentMethodId"><option value="">선택 안 함</option>{paymentMethods.filter((method) => method.isActive).map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></Field><Field label="보장 내역"><input name="coverageSummary" placeholder="보장 내역 (선택)" /></Field><Field label="연락처"><input name="contact" placeholder="연락처 (선택)" /></Field><button disabled={pending} className="tds-primary-button md:col-span-2">{pending ? '저장 중…' : '보험 추가'}</button></form>;
}

function InsuranceRow({ item, today }: { item: Insurance; today: string }) {
  const [state, action, pending] = useActionState(endInsuranceAction, INITIAL_ACTION_STATE);
  const active = item.status === 'active';
  const maturity = [item.paymentMaturityDate ? { label: '납입 만기', date: item.paymentMaturityDate } : null, item.coverageMaturityDate ? { label: '보장 만기', date: item.coverageMaturityDate } : null].filter((value): value is { label: string; date: string } => Boolean(value)).map((value) => ({ ...value, days: Math.ceil((Date.parse(`${value.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) })).filter((value) => value.days >= 0 && value.days <= 90).sort((a, b) => a.days - b.days)[0];
  return <article className={`tds-card flex min-w-0 flex-col gap-4 p-5 ${active ? '' : 'opacity-65'}`}><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-bold">{item.productName}</h2><p className="text-sm text-[var(--tds-grey-700)]">{item.insurerName} · {item.insuranceType}</p></div><div className="flex shrink-0 flex-wrap justify-end gap-2"><span className="rounded-full bg-[var(--tds-grey-100)] px-2 py-1 text-xs">{active ? '유지 중' : item.status === 'free' ? '납입 완료' : '해지'}</span>{active && maturity && <span className="rounded-full bg-[var(--tds-yellow-100)] px-2 py-1 text-xs font-semibold text-[var(--tds-yellow-700)]">{maturity.label} {maturity.days === 0 ? '오늘' : `${maturity.days}일 후`}</span>}</div></div><div><p className="text-xs text-[var(--tds-grey-500)]">월 보험료</p><strong className="text-xl tabular-nums">{won.format(item.monthlyPremium)}원</strong>{item.paymentDay && <span className="ml-2 text-sm text-[var(--tds-grey-700)]">매월 {item.paymentDay}일</span>}</div>{item.coverageSummary && <p className="rounded-xl bg-[var(--tds-blue-50)] p-3 text-sm">{item.coverageSummary}</p>}<p className="text-xs text-[var(--tds-grey-500)]">납입 만기 {item.paymentMaturityDate ?? '-'} · 보장 만기 {item.coverageMaturityDate ?? '-'}</p>{active && <><form action={action} className="grid grid-cols-2 gap-2"><input type="hidden" name="id" value={item.id} /><button name="status" value="free" disabled={pending} className="secondary-button">납입 완료</button><ConfirmSubmitButton name="status" value="terminated" disabled={pending} className="secondary-button text-[var(--tds-red-500)]" title="보험을 해지할까요?" description="해지 처리한 보험은 유지 중 목록에서 제외됩니다." confirmLabel="해지">해지</ConfirmSubmitButton></form><FormMessage result={state} /></>}</article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">{label}{children}</label>; }
