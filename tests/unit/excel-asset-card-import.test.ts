import { describe, expect, it } from 'vitest';
import { parseAssetRows, parseCardRows } from '@/lib/excel-asset-card-import';
describe('excel asset and card parsers', () => { it('parses asset values', () => { expect(parseAssetRows([['자산명', '종류', '취득가', '현재금액'], ['아파트', '부동산', '500000000', '600000000']])[0]).toMatchObject({ assetName: '아파트', assetType: 'real_estate', currentValue: 600000000 }); }); it('parses cards', () => { expect(parseCardRows([['발급처', '유형', '카드명', '연회비'], ['삼성', '신용', '국민행복카드', 0]])[0]).toMatchObject({ issuer: '삼성', cardType: 'credit', annualFee: 0 }); }); });
