'use client';

import { useActionState } from 'react';
import { createFinancialGoalAction, createFinancialTaskAction, toggleFinancialTaskAction } from '@/actions/planning-actions';
import { AddDrawer } from '@/components/Drawer';
import { AmountInput } from '@/components/AmountInput';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { SectionHeader } from '@/components/SectionHeader';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { FinancialGoal, FinancialTask } from '@/lib/excel-extended-data';

export type PlanningSection = 'goals' | 'tasks';
const won = (value: number | null) => value == null ? '-' : `${value.toLocaleString('ko-KR')}원`;

export function HouseholdPlanning({ goals, tasks, section }: { goals: FinancialGoal[]; tasks: FinancialTask[]; section?: PlanningSection }) {
  return <div className="flex flex-col gap-6">
    {(!section || section === 'goals') && <GoalSection goals={goals} />}
    {(!section || section === 'tasks') && <TaskSection tasks={tasks} />}
  </div>;
}

function Empty({ children }: { children: React.ReactNode }) { return <p className="py-5 text-sm text-[var(--tds-grey-500)]">{children}</p>; }

function GoalSection({ goals }: { goals: FinancialGoal[] }) { return <section id="goals" className="tds-card p-5"><SectionHeader title="재무 목표" description="목표 금액과 현재 진행 상황을 관리해요." action={<GoalDrawer />} /><div className="mt-5 divide-y divide-[var(--tds-grey-200)]">{goals.length === 0 ? <Empty>등록된 목표가 없습니다.</Empty> : goals.map((goal) => <div key={goal.id} className="py-3"><p className="font-semibold">{goal.name}</p><p className="mt-1 text-sm text-[var(--tds-grey-700)]">현재 {won(goal.currentValue)} · 목표 {won(goal.targetAmount)}{goal.targetDate ? ` · ${goal.targetDate}` : ''}</p></div>)}</div></section>; }
function GoalDrawer() { const [state, action, pending] = useActionState(createFinancialGoalAction, INITIAL_ACTION_STATE); return <AddDrawer title="재무 목표 추가" triggerLabel="목표 추가"><form action={action} className="grid gap-4"><FormMessage result={state} /><FormField label="목표명" required><input name="name" required placeholder="예: 내 집 마련" /></FormField><FormField label="목표 연도" required><input name="goalYear" type="number" min="2000" max="2200" defaultValue={new Date().getFullYear()} required placeholder="2026" /></FormField><FormField label="목표 금액"><AmountInput name="targetAmount" placeholder="0" /></FormField><FormField label="현재 금액"><AmountInput name="currentValue" placeholder="0" /></FormField><FormField label="목표 비율"><input name="targetRatio" type="number" min="0" max="100" step="0.1" placeholder="예: 30" /></FormField><FormField label="목표일"><input name="targetDate" type="date" /></FormField><FormField label="메모"><input name="memo" placeholder="선택 입력" /></FormField><button disabled={pending} className="tds-primary-button">{pending ? '저장 중…' : '목표 추가'}</button></form></AddDrawer>; }

function TaskSection({ tasks }: { tasks: FinancialTask[] }) { return <section id="tasks" className="tds-card p-5"><SectionHeader title="재무 일정" description="기념일, 점검일과 금융 일정을 관리해요." action={<TaskDrawer />} /><div className="mt-5 divide-y divide-[var(--tds-grey-200)]">{tasks.length === 0 ? <Empty>등록된 일정이 없습니다.</Empty> : tasks.map((task) => <TaskRow key={task.id} task={task} />)}</div></section>; }
function TaskDrawer() { const [state, action, pending] = useActionState(createFinancialTaskAction, INITIAL_ACTION_STATE); return <AddDrawer title="재무 일정 추가" triggerLabel="일정 추가"><form action={action} className="grid gap-4"><FormMessage result={state} /><FormField label="일정일" required><input name="taskDate" type="date" required /></FormField><FormField label="일정 제목" required><input name="title" required placeholder="예: 보험료 갱신 확인" /></FormField><FormField label="관련 유형"><input name="relatedType" placeholder="예: 보험" /></FormField><FormField label="설명"><input name="description" placeholder="선택 입력" /></FormField><button disabled={pending} className="tds-primary-button">{pending ? '저장 중…' : '일정 추가'}</button></form></AddDrawer>; }
function TaskRow({ task }: { task: FinancialTask }) { const [state, action, pending] = useActionState(toggleFinancialTaskAction, INITIAL_ACTION_STATE); return <form action={action} className={`flex items-center gap-3 py-3 ${task.completed ? 'opacity-60' : ''}`}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="completed" value={String(!task.completed)} /><button disabled={pending} className="h-5 w-5 rounded border" aria-label={`${task.title} 완료 상태 변경`}>{task.completed ? '✓' : ''}</button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{task.title}</p><p className="text-xs text-[var(--tds-grey-500)]">{task.taskDate}{task.relatedType ? ` · ${task.relatedType}` : ''}</p></div><FormMessage result={state} /></form>; }
