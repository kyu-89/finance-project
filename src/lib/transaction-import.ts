export type ImportField = 'date' | 'amount' | 'description' | 'status' | 'category' | 'memo' | 'card';

export type ImportMapping = Partial<Record<ImportField, string>>;

export type ParsedImportRow = {
  rowNumber: number;
  transactionDate: string | null;
  amount: number | null;
  transactionType: 'expense' | 'refund';
  description: string;
  categoryName: string | null;
  memo: string | null;
  cardLabel: string | null;
  errors: string[];
};

const aliases: Record<ImportField, string[]> = {
  date: ['이용일', '사용일', '승인일', '거래일', '거래일자', '결제일', '일자', '날짜', 'date', 'transactiondate', 'transaction date'],
  amount: ['이용금액', '사용금액', '승인금액', '결제금액', '청구금액', '매출금액', '거래금액', '금액', 'amount', 'price'],
  description: ['가맹점명', '이용가맹점', '이용처', '사용처', '가맹점', '거래처', '거래명', '적요', '내용', '상호명', '상호', 'merchant', 'merchantname', 'description', 'details'],
  status: ['승인상태', '거래구분', '취소여부', '취소구분', '처리상태', '구분', '상태', 'status', 'type'],
  category: ['대분류', '카테고리', '분류', 'category'],
  memo: ['비고', '메모', '할부', '할부개월', '승인번호', 'memo', 'note'],
  card: ['카드명', '카드번호', '카드', '결제수단', 'card', 'card name'],
};

export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u00a0_\-()[\]{}:/\\.·]/g, '');
}

function aliasScore(header: string, alias: string): number {
  const normalizedHeader = normalizeHeader(header);
  const normalizedAlias = normalizeHeader(alias);
  if (!normalizedHeader || !normalizedAlias) return 0;
  if (normalizedHeader === normalizedAlias) return 100;
  if (normalizedHeader.includes(normalizedAlias)) return 60;
  return 0;
}

export function detectMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  for (const field of Object.keys(aliases) as ImportField[]) {
    let best: { header: string; score: number } | null = null;
    for (const header of headers) {
      const score = Math.max(...aliases[field].map((alias) => aliasScore(header, alias)));
      if (score > (best?.score ?? 0)) best = { header, score };
    }
    if (best && best.score > 0) mapping[field] = best.header;
  }
  return mapping;
}

export function findHeaderRow(rows: unknown[][], maxRows = 40): { rowIndex: number; headers: string[]; mapping: ImportMapping } | null {
  let best: { rowIndex: number; headers: string[]; mapping: ImportMapping; score: number } | null = null;
  for (let rowIndex = 0; rowIndex < Math.min(maxRows, rows.length); rowIndex += 1) {
    const headers = rows[rowIndex].map((value) => String(value ?? '').trim());
    const mapping = detectMapping(headers);
    const requiredScore = (mapping.date ? 1 : 0) + (mapping.amount ? 1 : 0) + (mapping.description ? 1 : 0);
    const optionalScore = (mapping.status ? 1 : 0) + (mapping.category ? 1 : 0) + (mapping.card ? 1 : 0);
    const score = requiredScore * 10 + optionalScore;
    if (requiredScore >= 2 && score > (best?.score ?? 0)) best = { rowIndex, headers, mapping, score };
  }
  return best ? { rowIndex: best.rowIndex, headers: best.headers, mapping: best.mapping } : null;
}

function formatDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeImportDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (typeof value === 'number' && Number.isFinite(value) && value > 1) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const text = String(value ?? '').trim();
  if (!text) return null;
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return formatDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  const match = text.match(/^(\d{2,4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (!match) return null;
  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1]);
  return formatDate(year, Number(match[2]), Number(match[3]));
}

export function normalizeImportAmount(value: unknown): { amount: number | null; negative: boolean } {
  if (typeof value === 'number' && Number.isFinite(value)) return { amount: Math.abs(Math.round(value)), negative: value < 0 };
  const text = String(value ?? '').trim();
  if (!text) return { amount: null, negative: false };
  const negative = /^[-₩원\s]*-/.test(text) || /-$/.test(text) || /^\(.*\)$/.test(text);
  const numeric = Number(text.replace(/[₩원,\s]/g, '').replace(/^\((.*)\)$/, '$1').replace(/-$/, ''));
  return Number.isFinite(numeric) ? { amount: Math.abs(Math.round(numeric)), negative } : { amount: null, negative };
}

function valueAt(row: unknown[], headers: string[], header: string | undefined): unknown {
  if (!header) return undefined;
  return row[headers.indexOf(header)];
}

function isRefund(status: unknown): boolean {
  return /취소|환불|반품|cancel|refund|return/i.test(String(status ?? ''));
}

export function mapImportRows(rows: unknown[][], headers: string[], mapping: ImportMapping, headerRowIndex = 0): ParsedImportRow[] {
  const result: ParsedImportRow[] = [];
  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.some((value) => String(value ?? '').trim() !== '')) continue;
    const date = normalizeImportDate(valueAt(row, headers, mapping.date));
    const parsedAmount = normalizeImportAmount(valueAt(row, headers, mapping.amount));
    const description = String(valueAt(row, headers, mapping.description) ?? '').trim();
    const status = valueAt(row, headers, mapping.status);
    const errors: string[] = [];
    if (!date) errors.push('날짜를 읽지 못했어요.');
    if (parsedAmount.amount === null || parsedAmount.amount <= 0) errors.push('금액을 읽지 못했어요.');
    if (!description) errors.push('가맹점/내용이 비어 있어요.');
    result.push({
      rowNumber: index + 1,
      transactionDate: date,
      amount: parsedAmount.amount,
      transactionType: parsedAmount.negative || isRefund(status) ? 'refund' : 'expense',
      description,
      categoryName: String(valueAt(row, headers, mapping.category) ?? '').trim() || null,
      memo: String(valueAt(row, headers, mapping.memo) ?? '').trim() || null,
      cardLabel: String(valueAt(row, headers, mapping.card) ?? '').trim() || null,
      errors,
    });
  }
  return result;
}
