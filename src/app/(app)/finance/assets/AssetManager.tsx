'use client';

import { useActionState } from 'react';
import { createAssetAction, disposeAssetAction, updateAssetValueAction } from '@/actions/asset-actions';
import { Amount } from '@/components/Amount';
import { AmountInput } from '@/components/AmountInput';
import { AssetItem, AssetMetric } from '@/components/AssetItem';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { AddDrawer } from '@/components/Drawer';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Asset } from '@/lib/assets';

const typeName: Record<Asset['assetType'], string> = { real_estate: '부동산', car: '자동차', precious_metal: '귀금속', other: '기타' };

export function AssetManager({ assets, today }: { assets: Asset[]; today: string }) {
  const [state, action, pending] = useActionState(createAssetAction, INITIAL_ACTION_STATE);
  return <div className="flex flex-col gap-5">
    <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold">등록한 자산</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">보유 중인 자산의 평가액을 관리해요.</p></div><AddDrawer title="자산 추가" description="자산을 등록하면 현재 보유 목록에서 평가액을 수정할 수 있어요." triggerLabel="자산 추가"><form action={action} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><FormMessage result={state} /></div><Field label="자산명"><input name="assetName" required placeholder="예: 아파트, 자동차" /></Field><Field label="유형"><select name="assetType"><option value="real_estate">부동산</option><option value="car">자동차</option><option value="precious_metal">귀금속</option><option value="other">기타</option></select></Field><Field label="취득가"><AmountInput name="acquisitionCost" defaultValue="0" required placeholder="0" /></Field><Field label="현재 평가액"><AmountInput name="currentValue" required placeholder="현재 금액" /></Field><Field label="평가기준일"><input name="valuationDate" type="date" defaultValue={today} required aria-label="평가기준일" /></Field><Field label="비고"><input name="memo" placeholder="필요한 메모를 입력하세요 (선택)" /></Field><button disabled={pending} className="tds-primary-button md:col-span-2">{pending ? '저장 중…' : '자산 저장'}</button></form></AddDrawer></div>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">{assets.length === 0 && <p className="tds-card p-6 text-sm text-[var(--tds-grey-500)]">등록한 자산이 없어요.</p>}{assets.map((asset) => <AssetCard key={asset.id} asset={asset} />)}</div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <FormField label={label} className="min-w-0">{children}</FormField>; }

function AssetCard({ asset }: { asset: Asset }) {
  const [valueState, valueAction, valuePending] = useActionState(updateAssetValueAction, INITIAL_ACTION_STATE);
  const [disposeState, disposeAction, disposePending] = useActionState(disposeAssetAction, INITIAL_ACTION_STATE);
  const active = asset.status === 'active';
  return <AssetItem
    title={asset.assetName}
    subtitle={`${typeName[asset.assetType]} · ${asset.valuationDate} 기준`}
    statusBadge={<Badge variant={active ? 'positive' : 'neutral'}>{active ? '보유 중' : '처분'}</Badge>}
    primaryLabel="현재 평가액"
    primaryValue={<Amount value={asset.currentValue} size="medium" />}
    metrics={<AssetMetric label="취득가" value={asset.acquisitionCost} />}
    dimmed={!active}
    actions={active && <>
      <form action={valueAction} className="flex min-w-0 gap-2"><input type="hidden" name="id" value={asset.id} /><AmountInput name="value" defaultValue={asset.currentValue} className="min-w-0 flex-1 text-right" placeholder="평가액" aria-label="현재 평가액" /><Button type="submit" variant="secondary" className="shrink-0" disabled={valuePending}>{valuePending ? '저장 중…' : '평가액 수정'}</Button></form>
      <FormMessage result={valueState} />
      <form action={disposeAction}><input type="hidden" name="id" value={asset.id} /><ConfirmSubmitButton disabled={disposePending} className="tds-button-secondary tds-button-danger w-full" title="자산을 처분할까요?" description="처분한 자산은 보유 자산에서 제외됩니다." confirmLabel="처분">{disposePending ? '처리 중…' : '처분 처리'}</ConfirmSubmitButton></form>
      <FormMessage result={disposeState} />
    </>}
  />;
}
