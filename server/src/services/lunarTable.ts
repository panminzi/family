// Compact lunar holiday + solar term lookup. Covers 2025-2030 to keep the V0.2
// trigger engine self-contained. For longer horizons, swap in `lunar-javascript`.
// Dates are gregorian (YYYY-MM-DD) for the lunar/solar-term events that vary
// year-to-year.

export type LunarHoliday =
  | 'spring_festival_eve'
  | 'spring_festival'
  | 'lantern'
  | 'qingming'
  | 'dragon_boat'
  | 'midautumn'
  | 'dongzhi';

interface YearTable {
  spring_festival_eve: string;     // 除夕（农历腊月最后一天）
  spring_festival: string;          // 正月初一
  spring_festival_end: string;      // 初五
  lantern: string;                  // 正月十五
  qingming: string;                 // 节气清明
  dragon_boat: string;              // 五月初五
  midautumn: string;                // 八月十五
  dongzhi: string;                  // 节气冬至
  beginning_of_winter: string;      // 节气立冬
  beginning_of_summer: string;      // 节气立夏
  beginning_of_autumn: string;      // 节气立秋
}

const TABLE: Record<number, YearTable> = {
  2025: {
    spring_festival_eve: '2025-01-28',
    spring_festival: '2025-01-29',
    spring_festival_end: '2025-02-02',
    lantern: '2025-02-12',
    qingming: '2025-04-04',
    dragon_boat: '2025-05-31',
    midautumn: '2025-10-06',
    dongzhi: '2025-12-21',
    beginning_of_winter: '2025-11-07',
    beginning_of_summer: '2025-05-05',
    beginning_of_autumn: '2025-08-07',
  },
  2026: {
    spring_festival_eve: '2026-02-16',
    spring_festival: '2026-02-17',
    spring_festival_end: '2026-02-21',
    lantern: '2026-03-03',
    qingming: '2026-04-05',
    dragon_boat: '2026-06-19',
    midautumn: '2026-09-25',
    dongzhi: '2026-12-22',
    beginning_of_winter: '2026-11-07',
    beginning_of_summer: '2026-05-05',
    beginning_of_autumn: '2026-08-07',
  },
  2027: {
    spring_festival_eve: '2027-02-05',
    spring_festival: '2027-02-06',
    spring_festival_end: '2027-02-10',
    lantern: '2027-02-20',
    qingming: '2027-04-05',
    dragon_boat: '2027-06-09',
    midautumn: '2027-09-15',
    dongzhi: '2027-12-22',
    beginning_of_winter: '2027-11-08',
    beginning_of_summer: '2027-05-06',
    beginning_of_autumn: '2027-08-08',
  },
  2028: {
    spring_festival_eve: '2028-01-25',
    spring_festival: '2028-01-26',
    spring_festival_end: '2028-01-30',
    lantern: '2028-02-09',
    qingming: '2028-04-04',
    dragon_boat: '2028-05-28',
    midautumn: '2028-10-03',
    dongzhi: '2028-12-21',
    beginning_of_winter: '2028-11-07',
    beginning_of_summer: '2028-05-05',
    beginning_of_autumn: '2028-08-07',
  },
  2029: {
    spring_festival_eve: '2029-02-12',
    spring_festival: '2029-02-13',
    spring_festival_end: '2029-02-17',
    lantern: '2029-02-27',
    qingming: '2029-04-04',
    dragon_boat: '2029-06-16',
    midautumn: '2029-09-22',
    dongzhi: '2029-12-21',
    beginning_of_winter: '2029-11-07',
    beginning_of_summer: '2029-05-05',
    beginning_of_autumn: '2029-08-07',
  },
  2030: {
    spring_festival_eve: '2030-02-02',
    spring_festival: '2030-02-03',
    spring_festival_end: '2030-02-07',
    lantern: '2030-02-17',
    qingming: '2030-04-05',
    dragon_boat: '2030-06-05',
    midautumn: '2030-09-12',
    dongzhi: '2030-12-22',
    beginning_of_winter: '2030-11-07',
    beginning_of_summer: '2030-05-05',
    beginning_of_autumn: '2030-08-07',
  },
};

export function lookupYear(year: number): YearTable | null {
  return TABLE[year] ?? null;
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function inSpringFestivalRange(today: string, t: YearTable): boolean {
  return today >= t.spring_festival_eve && today <= t.spring_festival_end;
}

export function isInSummer(today: string, t: YearTable): boolean {
  return today >= t.beginning_of_summer && today < t.beginning_of_autumn;
}
