import { describe, expect, it } from 'vitest';
import { detectTriggers } from '../src/services/triggers';

const baseMembers = [
  { id: 'mom', name: '妈', birthday: '1980-09-25' },
  { id: 'dad', name: '爸', birthday: null },
];

describe('V0.2 trigger engine', () => {
  it('fires birthday on dinner only and gives it P0 priority', async () => {
    const r = detectTriggers({
      spaceId: 's',
      mealType: 'dinner',
      today: '2026-09-25',
      region: 'north',
      weather: 'clear',
      members: baseMembers,
      customEvents: [],
    });
    expect(r.primary?.triggerId).toBe('family_birthday');
    expect(r.primary?.priority).toBe(0);
  });

  it('does not fire birthday at breakfast', async () => {
    const r = detectTriggers({
      spaceId: 's',
      mealType: 'breakfast',
      today: '2026-09-25',
      region: 'north',
      weather: 'clear',
      members: baseMembers,
      customEvents: [],
    });
    expect(r.primary).toBe(null);
  });

  it('detects mid-autumn at dinner', async () => {
    // 2026 mid-autumn = 2026-09-25 — also mom's birthday in test setup so we
    // shift birthday off this day and use a clean year/date instead.
    const r = detectTriggers({
      spaceId: 's',
      mealType: 'dinner',
      today: '2027-09-15', // 2027 mid-autumn
      region: 'north',
      weather: 'clear',
      members: [{ id: 'mom', name: '妈', birthday: null }],
      customEvents: [],
    });
    expect(r.primary?.triggerId).toBe('holiday_midautumn');
  });

  it('birthday outranks holiday on the same day (P0 > P2)', async () => {
    const r = detectTriggers({
      spaceId: 's',
      mealType: 'dinner',
      today: '2027-09-15',
      region: 'north',
      weather: 'clear',
      members: [{ id: 'mom', name: '妈', birthday: '1980-09-15' }],
      customEvents: [],
    });
    expect(r.primary?.triggerId).toBe('family_birthday');
  });

  it('weather rain becomes overlay, not primary', async () => {
    const r = detectTriggers({
      spaceId: 's',
      mealType: 'dinner',
      today: '2026-04-15',
      region: 'north',
      weather: 'rain',
      members: baseMembers,
      customEvents: [],
    });
    expect(r.primary).toBe(null);
    expect(r.overlays.some((o) => o.triggerId === 'weather_rain')).toBe(true);
  });

  it('switches dongzhi opening hook by region', async () => {
    const north = detectTriggers({
      spaceId: 's',
      mealType: 'dinner',
      today: '2026-12-22',
      region: 'north',
      weather: 'clear',
      members: [{ id: 'mom', name: '妈', birthday: null }],
      customEvents: [],
    });
    expect(north.primary?.openingHook).toContain('饺子');
    const south = detectTriggers({
      spaceId: 's',
      mealType: 'dinner',
      today: '2026-12-22',
      region: 'south',
      weather: 'clear',
      members: [{ id: 'mom', name: '妈', birthday: null }],
      customEvents: [],
    });
    expect(south.primary?.openingHook).toContain('汤圆');
  });

  it('matches custom anniversary/birthday events on MM-DD', async () => {
    const r = detectTriggers({
      spaceId: 's',
      mealType: 'dinner',
      today: '2026-07-20',
      region: 'north',
      weather: 'clear',
      members: [{ id: 'mom', name: '妈', birthday: null }],
      customEvents: [
        { kind: 'birthday', memberId: 'mom', dateRule: '07-20', title: '妈生日' },
      ],
    });
    expect(r.primary?.triggerId).toBe('family_birthday');
  });
});
