import { describe, expect, it } from 'vitest';
import { parseAssetRows } from '@/lib/excel-asset-import';
describe('excel asset parser', () => { it('parses asset values', () => { expect(parseAssetRows([['자산명', '종류', '취득가', '현재금액'], ['아파트', '부동산', '500000000', '600000000']])[0]).toMatchObject({ assetName: '아파트', assetType: 'real_estate', currentValue: 600000000 }); }); });
