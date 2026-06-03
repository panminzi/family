// Cron-driven scheduler that triggers a dinner session for every space at meal time.
// `runMealTrigger` is the unit-testable core — the cron wiring around it is thin.
// V0.2 also runs a weekly summarizer to compress L3 dialogue → L2 episodic events.

import cron from 'node-cron';
import { getPrisma } from '../utils/prisma';
import { startDinnerSession, MealType } from '../services/dinner';
import { summarizeWindow } from '../services/memory';

export interface RunMealTriggerOpts {
  mealType: MealType;
  // Cap how many spaces are triggered per tick (defensive default).
  limit?: number;
  weather?: 'rain' | 'snow' | 'clear';
}

export interface RunMealTriggerResult {
  triggered: Array<{ spaceId: string; sessionId: string; turns: number; trigger?: string | null }>;
  skipped: Array<{ spaceId: string; reason: string }>;
}

export async function runMealTrigger(
  opts: RunMealTriggerOpts,
): Promise<RunMealTriggerResult> {
  const prisma = getPrisma();
  const spaces = await prisma.familySpace.findMany({
    take: opts.limit ?? 200,
    include: { _count: { select: { members: true } } },
  });
  const triggered: RunMealTriggerResult['triggered'] = [];
  const skipped: RunMealTriggerResult['skipped'] = [];
  for (const s of spaces) {
    if (s._count.members < 1) {
      skipped.push({ spaceId: s.id, reason: 'no_members' });
      continue;
    }
    try {
      const r = await startDinnerSession({ spaceId: s.id, mealType: opts.mealType, weather: opts.weather });
      triggered.push({
        spaceId: s.id,
        sessionId: r.sessionId,
        turns: r.turns.length,
        trigger: r.trigger?.triggerId ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      skipped.push({ spaceId: s.id, reason: msg });
    }
  }
  return { triggered, skipped };
}

export async function runWeeklySummarizer(opts?: {
  now?: Date;
  windowDays?: number;
}): Promise<{ summarized: number; spaces: number }> {
  const prisma = getPrisma();
  const now = opts?.now ?? new Date();
  const windowDays = opts?.windowDays ?? 7;
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - windowDays * 24 * 3600 * 1000);
  const spaces = await prisma.familySpace.findMany({ include: { members: true } });
  let total = 0;
  for (const s of spaces) {
    for (const m of (s as any).members) {
      const events = await summarizeWindow({
        spaceId: s.id,
        subjectMemberId: m.id,
        scope: 'weekly',
        periodStart,
        periodEnd,
      });
      total += events.length;
    }
  }
  return { summarized: total, spaces: spaces.length };
}

export interface SchedulerHandle {
  stop(): void;
  jobs: cron.ScheduledTask[];
}

export function startScheduler(spec: {
  cronBreakfast: string;
  cronLunch: string;
  cronDinner: string;
  cronSummary?: string;
}): SchedulerHandle {
  const jobs: cron.ScheduledTask[] = [];
  const wrap =
    (mealType: MealType) =>
    async (): Promise<void> => {
      try {
        await runMealTrigger({ mealType });
      } catch (e) {
        // Logged but never thrown — the scheduler must not crash.
        // eslint-disable-next-line no-console
        console.error('[scheduler] meal trigger failed:', mealType, e);
      }
    };
  jobs.push(cron.schedule(spec.cronBreakfast, wrap('breakfast')));
  jobs.push(cron.schedule(spec.cronLunch, wrap('lunch')));
  jobs.push(cron.schedule(spec.cronDinner, wrap('dinner')));
  if (spec.cronSummary) {
    jobs.push(
      cron.schedule(spec.cronSummary, async () => {
        try {
          await runWeeklySummarizer();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[scheduler] weekly summarizer failed:', e);
        }
      }),
    );
  }
  return {
    stop(): void {
      for (const j of jobs) j.stop();
    },
    jobs,
  };
}

