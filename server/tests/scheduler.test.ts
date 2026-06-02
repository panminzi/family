import { describe, expect, it } from 'vitest';
import { startScheduler } from '../src/jobs/scheduler';

describe('scheduler', () => {
  it('schedules three cron jobs and stops cleanly', () => {
    const handle = startScheduler({
      cronBreakfast: '30 7 * * *',
      cronLunch: '0 12 * * *',
      cronDinner: '30 18 * * *',
    });
    expect(handle.jobs).toHaveLength(3);
    handle.stop();
  });

  it('throws on invalid cron expressions', () => {
    expect(() =>
      startScheduler({
        cronBreakfast: 'not-a-cron',
        cronLunch: '0 12 * * *',
        cronDinner: '30 18 * * *',
      }),
    ).toThrow();
  });
});
