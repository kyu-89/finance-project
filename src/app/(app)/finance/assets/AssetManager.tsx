'use client';

import { useActionState } from 'react';
import { createAssetAction, disposeAssetAction, updateAssetValueAction } from '@/actions/asset-actions';
import { AddDrawer } from '@/components/Drawer';
import { FormMessage } from '@/components/FormMessage';
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Asset } from '@/lib/assets';
import type { HouseholdMember } from '@/lib/household';

const won = new Intl.NumberFormat('ko-KR');
const typeName: Record<Asset['assetType'], string> = { real_estate: '부동산', car: '자동차', precious_metal: '귀금속', other: '기타' };

export function AssetManager({ assets, members, today }: { assets: Asset[]; members: HouseholdMember[]; today: string }) {
  const [state, action, pending] = useActionState(createAssetAction, INITIAL_ACTION_STATE);
  return <div className="flex flex-col gap-5">
    <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold">등록한 자산</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">보유 중인 자산의 평가액을 관리해요.</p></div><AddDrawer title="자산 추가" description="자산을 등록하면 현재 보유 목록에서 평가액을 수정할 수 있어요." triggerLabel="자산 추가"><form action={action} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><FormMessage result={state} /></div><Field label="자산명"><input name="assetName" required placeholder="예: 아파트, 자동차" /></Field><Field label="유형"><select name="assetType"><option value="real_estate">부동산</option><option value="car">자동차</option><option value="precious_metal">귀금속</option><option value="other">기타</option></select></Field><Field label="취득가"><input name="acquisitionCost" type="number" min="0" step="1" defaultValue="0" required placeholder="0" /></Field><Field label="현재 평가액"><input name="currentValue" type="number" min="0" step="1" required placeholder="현재 금액" /></Field><Field label="평가기준일"><input name="valuationDate" type="date" defaultValue={today} required aria-label="평가기준일" /></Field><Field label="명의자"><select name="ownerMemberId"><option value="">선택 안 함</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></Field><Field label="비고"><input name="memo" placeholder="필요한 메모를 입력하세요 (선택)" /></Field><button disabled={pending} className="tds-primary-button md:col-span-2">{pending ? '저장 중…' : '자산 저장'}</button></form></AddDrawer></div>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">{assets.length === 0 && <p className="tds-card p-6 text-sm text-[var(--tds-grey-500)]">등록한 자산이 없어요.</p>}{assets.map((asset) => <AssetCard key={asset.id} asset={asset} />)}</div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">{label}{children}</label>; }

function AssetCard({ asset }: { asset: Asset }) {
  const [valueState, valueAction, valuePending] = useActionState(updateAssetValueAction, INITIAL_ACTION_STATE);
  const [disposeState, disposeAction, disposePending] = useActionState(disposeAssetAction, INITIAL_ACTION_STATE);
  const active = asset.status === 'active';
  return <article className={`tds-card flex min-w-0 flex-col gap-4 p-5 ${active ? '' : 'opacity-65'}`}><div className="flex min-w-0 justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-bold">{asset.assetName}</h2><p className="text-sm text-[var(--tds-grey-700)]">{typeName[asset.assetType]} · {asset.valuationDate} 기준</p></div><span className="shrink-0 rounded-full bg-[var(--tds-grey-100)] px-2 py-1 text-xs">{active ? '보유 중' : '처분'}</span></div><div><p className="text-xs text-[var(--tds-grey-500)]">현재 평가액</p><strong className="text-xl tabular-nums">{won.format(asset.currentValue)}원</strong><p className="text-xs text-[var(--tds-grey-500)]">취득가 {won.format(asset.acquisitionCost)}원</p></div>{active && <><form action={valueAction} className="flex min-w-0 gap-2"><input type="hidden" name="id" value={asset.id} /><input name="value" type="number" min="0" step="1" defaultValue={asset.currentValue} className="min-w-0 flex-1 text-right" placeholder="평가액" aria-label="현재 평가액" /><button disabled={valuePending} className="secondary-button shrink-0">{valuePending ? '저장 중…' : '평가액 수정'}</button></form><FormMessage result={valueState} /><form action={disposeAction}><input type="hidden" name="id" value={asset.id} /><ConfirmSubmitButton disabled={disposePending} className="secondary-button w-full text-[var(--tds-red-500)]" title="자산을 처분할까요?" description="처분한 자산은 보유 자산에서 제외됩니다." confirmLabel="처분">{disposePending ? '처리 중…' : '처분 처리'}</ConfirmSubmitButton></form><FormMessage result={disposeState} /></>}</article>;
}
