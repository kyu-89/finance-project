'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentHouseholdId } from '@/lib/household';
import { createFinancialGoal, createFinancialTask, listFinancialGoals, listFinancialTasks } from '@/lib/excel-extended-data';
import { fail, ok, type ActionResult } from '@/lib/action-result';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function importPlanningAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const goals = JSON.parse(String(form.get('goals') ?? '[]')) as Array<Record<string, unknown>>;
    const tasks = JSON.parse(String(form.get('tasks') ?? '[]')) as Array<Record<string, unknown>>;
    if (!Array.isArray(goals) || !Array.isArray(tasks) || goals.length + tasks.length === 0 || goals.length + tasks.length > 1000) return fail('가져올 목표·일정이 없거나 너무 많아요.');
    const householdId = await getCurrentHouseholdId();
    const [existingGoals, existingTasks] = await Promise.all([listFinancialGoals(householdId), listFinancialTasks(householdId)]);
    const goalKeys = new Set(existingGoals.map((goal) => `${goal.goalYear}|${goal.name.trim().toLocaleLowerCase()}`));
    const taskKeys = new Set(existingTasks.map((task) => `${task.taskDate}|${task.title.trim().toLocaleLowerCase()}`));
    let insertedGoals = 0; let insertedTasks = 0; let duplicateCount = 0;
    for (const goal of goals) {
      const goalYear = Number(goal.goalYear); const name = String(goal.name ?? '').trim();
      const targetAmount = goal.targetAmount === null || goal.targetAmount === undefined || goal.targetAmount === '' ? null : Number(goal.targetAmount);
      const targetRatio = goal.targetRatio === null || goal.targetRatio === undefined || goal.targetRatio === '' ? null : Number(goal.targetRatio);
      const targetDate = goal.targetDate ? String(goal.targetDate) : null;
      if (!Number.isInteger(goalYear) || goalYear < 2000 || goalYear > 2100 || !name || (targetAmount !== null && (!Number.isSafeInteger(targetAmount) || targetAmount < 0)) || (targetRatio !== null && (!Number.isFinite(targetRatio) || targetRatio < 0 || targetRatio > 1)) || (targetDate !== null && !datePattern.test(targetDate))) return fail('유효하지 않은 재무 목표가 포함되어 있어요.');
      const key = `${goalYear}|${name.toLocaleLowerCase()}`;
      if (goalKeys.has(key)) { duplicateCount += 1; continue; }
      await createFinancialGoal({ householdId, goalYear, name, targetAmount, targetRatio, targetDate, currentValue: null, memo: 'Excel 가져오기' });
      goalKeys.add(key); insertedGoals += 1;
    }
    for (const task of tasks) {
      const taskDate = String(task.taskDate ?? ''); const title = String(task.title ?? '').trim(); const description = task.description ? String(task.description).trim() : null;
      if (!datePattern.test(taskDate) || !title) return fail('유효하지 않은 재무 일정이 포함되어 있어요.');
      const key = `${taskDate}|${title.toLocaleLowerCase()}`;
      if (taskKeys.has(key)) { duplicateCount += 1; continue; }
      await createFinancialTask({ householdId, taskDate, title, description, relatedType: null });
      taskKeys.add(key); insertedTasks += 1;
    }
    revalidatePath('/settings'); revalidatePath('/dashboard');
    return ok(`목표 ${insertedGoals}건·일정 ${insertedTasks}건을 가져왔어요${duplicateCount ? ` · 중복 ${duplicateCount}건은 건너뛰었어요` : ''}.`);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '목표·일정 가져오기에 실패했어요.');
  }
}
