'use client';

import * as XLSX from 'xlsx';
import { useActionState, useMemo, useState } from 'react';
import { importPlanningAction } from '@/actions/planning-import-actions';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { parsePlanningRows, type ParsedGoal, type ParsedTask } from '@/lib/excel-planning-import';

function sourceYear(fileName: string) {
  const match = fileName.match(/20\d{2}/);
  return match ? Number(match[0]) : new Date().getFullYear();
}

export function PlanningImport() {
  const [goals, setGoals] = useState<ParsedGoal[]>([]);
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [message, setMessage] = useState('');
  const [state, action, pending] = useActionState(importPlanningAction, INITIAL_ACTION_STATE);
  const validGoals = useMemo(() => goals.filter((item) => item.errors.length === 0), [goals]);
  const validTasks = useMemo(() => tasks.filter((item) => item.errors.length === 0), [tasks]);

  async function handleFile(file: File) {
    setMessage('');
    setGoals([]);
    setTasks([]);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, dense: true });
      const sheetName = workbook.SheetNames.find((name) => name === '메인');
      const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
      if (!sheet) {
        setMessage('메인 시트를 찾지 못했습니다.');
        return;
      }
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as unknown[][];
      const result = parsePlanningRows(rows, sourceYear(file.name));
      setGoals(result.goals);
      setTasks(result.tasks);
    } catch {
      setMessage('Excel 파일을 읽지 못했습니다.');
    }
  }

  const total = validGoals.length + validTasks.length;
  return (
    <section className="tds-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">재무 목표·일정 Excel 가져오기</h2>
          <p className="mt-1 text-sm text-[var(--tds-grey-700)]">메인 시트의 목표와 일정 문구를 분리해 등록합니다.</p>
        </div>
        <label className="tds-button-secondary inline-flex cursor-pointer px-4">
          <span>Excel 파일 선택</span>
          <input className="sr-only" type="file" accept=".xlsx,.xls,.xlsm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />
        </label>
      </div>
      {message && <p role="alert" className="mt-3 text-sm text-[var(--tds-red-500)]">{message}</p>}
      {total > 0 && <>
        <p className="mt-4 text-sm">목표 {validGoals.length}건 · 일정 {validTasks.length}건</p>
        <FormMessage result={state} />
        <form action={action}>
          <input type="hidden" name="goals" value={JSON.stringify(validGoals)} />
          <input type="hidden" name="tasks" value={JSON.stringify(validTasks)} />
          <button disabled={pending} className="tds-primary-button mt-4 w-full">{pending ? '가져오는 중…' : `${total}건 가져오기`}</button>
        </form>
      </>}
    </section>
  );
}
