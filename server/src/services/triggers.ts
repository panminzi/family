// V0.2 trigger engine. Detects which scenes (besides plain breakfast/lunch/dinner)
// should fire for a space at a given moment. Holidays/solar terms come from the
// compact lunar table; birthdays come from FamilyEvent. Weather is read via a
// pluggable provider (default: stub returning `clear`).

import { getPrisma } from '../utils/prisma';
import {
  inSpringFestivalRange,
  isInSummer,
  isoDate,
  lookupYear,
} from './lunarTable';
import type { MealType } from './dinner';

export interface TriggerHit {
  triggerId: string;
  sceneId: string;
  priority: number; // 0=highest
  label: string;
  props: string[];
  openingHook: string;
  promptInjection: string;
}

export interface TriggerContext {
  spaceId: string;
  mealType: MealType;
  // ISO yyyy-mm-dd in space.locale timezone — caller injects to keep this pure.
  today: string;
  region: 'north' | 'south';
  weather?: 'rain' | 'snow' | 'clear';
  members: Array<{ id: string; name: string; birthday?: string | null }>;
  customEvents: Array<{
    kind: 'birthday' | 'anniversary';
    memberId: string | null;
    dateRule: string;
    title: string;
  }>;
}

export interface DetectionResult {
  primary: TriggerHit | null;
  overlays: TriggerHit[]; // weather / minor scenes added on top
  all: TriggerHit[];
}

const SCENE_LIBRARY: Record<string, Omit<TriggerHit, 'triggerId'>> = {
  scene_spring_festival_eve_v1: {
    sceneId: 'scene_spring_festival_eve_v1',
    priority: 1,
    label: '除夕年夜饭',
    props: ['饺子', '年糕', '红烧鱼', '红包', '春联', '橘子'],
    openingHook: '都过来都过来，包饺子啦——今年谁包硬币那一个？',
    promptInjection:
      '今天是除夕，全家围着餐桌包饺子、聊家常，气氛热闹但不要说"祝阖家欢乐"这种官话，至少有一句对包饺子手艺的吐槽。',
  },
  scene_spring_festival_day_v1: {
    sceneId: 'scene_spring_festival_day_v1',
    priority: 2,
    label: '春节家宴',
    props: ['饺子', '汤圆', '瓜子', '糖果', '红包'],
    openingHook: '新年好——红包呢红包呢？',
    promptInjection: '正月里，餐桌上有剩菜复热的饺子/汤圆，氛围慵懒带闹腾，可以聊拜年口令、起床晚、新衣服。',
  },
  scene_lantern_v1: {
    sceneId: 'scene_lantern_v1',
    priority: 2,
    label: '元宵节晚餐',
    props: ['汤圆', '花灯', '灯谜小卡片'],
    openingHook: '今天吃汤圆，谁先猜灯谜猜中谁先吃。',
    promptInjection: '元宵节，汤圆咸甜两种，可以围绕南北差异、灯谜展开。',
  },
  scene_dragon_boat_v1: {
    sceneId: 'scene_dragon_boat_v1',
    priority: 2,
    label: '端午午餐',
    props: ['粽子', '咸蛋黄', '艾草'],
    openingHook: '粽子来了——咸的甜的肉的，自己挑！',
    promptInjection: '端午节中午，桌上摆粽子和咸蛋黄，可以聊南北咸甜党、蛋黄、谁包得最丑。',
  },
  scene_midautumn_dinner_v1: {
    sceneId: 'scene_midautumn_dinner_v1',
    priority: 2,
    label: '中秋晚餐',
    props: ['月饼', '柚子', '桂花茶'],
    openingHook: '今晚月亮真大，月饼切了，每人一块。',
    promptInjection:
      '中秋节晚饭，餐桌中央切了月饼，剥好的柚子分两半，气氛温馨明亮；可以聊五仁好不好吃、谁吃蛋黄。',
  },
  scene_dongzhi_v1: {
    sceneId: 'scene_dongzhi_v1',
    priority: 2,
    label: '冬至晚餐',
    props: ['饺子', '汤圆', '热汤', '姜茶'],
    openingHook: '冬至大如年，今天吃这个——',
    promptInjection: '冬至晚餐，按家庭地区切换：北方主菜饺子，南方主菜汤圆。氛围温暖家常。',
  },
  scene_birthday_v1: {
    sceneId: 'scene_birthday_v1',
    priority: 0,
    label: '成员生日',
    props: ['生日蛋糕', '蜡烛', '长寿面', '小礼物'],
    openingHook: '来——准备好，开始啦。',
    promptInjection:
      '今天是家里某位成员的生日，餐桌中央有生日蛋糕和长寿面。寿星要有反应有吐槽，开场第一句不能由寿星本人说，避免出现具体年龄数字，只说"又长一岁"。',
  },
  scene_weather_rain_overlay_v1: {
    sceneId: 'scene_weather_rain_overlay_v1',
    priority: 3,
    label: '下雨叠加',
    props: ['伞', '湿外套', '热汤'],
    openingHook: '',
    promptInjection: '今天外面在下雨，对话开头可以有 1 句关于雨的台词（如收衣服、伞湿了），但不要让天气成为话题主线。',
  },
  scene_weather_snow_overlay_v1: {
    sceneId: 'scene_weather_snow_overlay_v1',
    priority: 3,
    label: '下雪叠加',
    props: ['围巾', '热饮'],
    openingHook: '',
    promptInjection: '今天外面在下雪，对话里可以有 1 句\"窗外开始下雪了\"作为环境注入，让 1-2 个角色看一眼窗外。',
  },
};

function makeHit(triggerId: string, sceneId: string): TriggerHit {
  const tmpl = SCENE_LIBRARY[sceneId];
  if (!tmpl) throw new Error(`unknown_scene:${sceneId}`);
  return { triggerId, ...tmpl };
}

export function detectTriggers(ctx: TriggerContext): DetectionResult {
  const hits: TriggerHit[] = [];
  const todayMD = ctx.today.slice(5); // MM-DD
  const yearTable = lookupYear(Number(ctx.today.slice(0, 4)));

  // 1. Birthday — P0 (highest). For dinner-meal only (per design 4.1).
  if (ctx.mealType === 'dinner') {
    const birthday = matchBirthday(ctx, todayMD);
    if (birthday) hits.push(makeHit('family_birthday', 'scene_birthday_v1'));
  }

  // 2. Spring festival
  if (yearTable) {
    if (ctx.today === yearTable.spring_festival_eve && ctx.mealType === 'dinner') {
      hits.push(makeHit('holiday_spring_festival_eve', 'scene_spring_festival_eve_v1'));
    } else if (inSpringFestivalRange(ctx.today, yearTable)) {
      hits.push(makeHit('holiday_spring_festival', 'scene_spring_festival_day_v1'));
    }
    if (ctx.today === yearTable.lantern && ctx.mealType === 'dinner') {
      hits.push(makeHit('holiday_lantern', 'scene_lantern_v1'));
    }
    if (ctx.today === yearTable.dragon_boat && ctx.mealType === 'lunch') {
      hits.push(makeHit('holiday_dragon_boat', 'scene_dragon_boat_v1'));
    }
    if (ctx.today === yearTable.midautumn && ctx.mealType === 'dinner') {
      hits.push(makeHit('holiday_midautumn', 'scene_midautumn_dinner_v1'));
    }
    if (ctx.today === yearTable.dongzhi && ctx.mealType === 'dinner') {
      hits.push(makeHit('holiday_dongzhi', 'scene_dongzhi_v1'));
    }
  }

  // 3. Weather overlays (always overlay, never primary)
  if (ctx.weather === 'rain') {
    hits.push(makeHit('weather_rain', 'scene_weather_rain_overlay_v1'));
  } else if (ctx.weather === 'snow') {
    hits.push(makeHit('weather_snow', 'scene_weather_snow_overlay_v1'));
  }

  // Decide primary + overlays. Primary = lowest priority number among non-weather.
  const nonOverlay = hits.filter((h) => h.priority < 3);
  nonOverlay.sort((a, b) => a.priority - b.priority);
  const primary = nonOverlay[0] ?? null;
  const overlays = hits.filter((h) => h !== primary && h.priority >= 3);

  // (we don't carry summer-night / dongzhi south-vs-north logic deeper here —
  // region only flips opening for dongzhi)
  if (primary?.sceneId === 'scene_dongzhi_v1') {
    primary.openingHook =
      ctx.region === 'south'
        ? '冬至大如年，搓汤圆啦——'
        : '冬至不吃饺子要冻耳朵——快吃。';
  }
  void isInSummer; // reserved for v0.3 summer-night standalone scene.

  return { primary, overlays, all: hits };
}

function matchBirthday(ctx: TriggerContext, todayMD: string): boolean {
  for (const m of ctx.members) {
    if (m.birthday && extractMD(m.birthday) === todayMD) return true;
  }
  for (const e of ctx.customEvents) {
    if (e.kind !== 'birthday') continue;
    if (extractMD(e.dateRule) === todayMD) return true;
  }
  return false;
}

function extractMD(s: string): string {
  // Accepts "YYYY-MM-DD", "MM-DD", "L-MM-DD".
  const cleaned = s.startsWith('L-') ? s.slice(2) : s;
  const parts = cleaned.split('-');
  if (parts.length === 3) return `${pad2(parts[1])}-${pad2(parts[2])}`;
  if (parts.length === 2) return `${pad2(parts[0])}-${pad2(parts[1])}`;
  return cleaned;
}

function pad2(s: string): string {
  return s.length === 1 ? `0${s}` : s;
}

// Convenience: build context from DB then run detect.
export async function detectForSpace(
  spaceId: string,
  mealType: MealType,
  now: Date = new Date(),
  weather: 'rain' | 'snow' | 'clear' = 'clear',
): Promise<DetectionResult> {
  const prisma = getPrisma();
  const space = await prisma.familySpace.findUnique({
    where: { id: spaceId },
    include: { members: true, events: true },
  });
  if (!space) return { primary: null, overlays: [], all: [] };
  return detectTriggers({
    spaceId,
    mealType,
    today: isoDate(now),
    region: (space.region as 'north' | 'south') ?? 'north',
    weather,
    members: space.members.map((m: any) => ({ id: m.id, name: m.name, birthday: m.birthday })),
    customEvents: space.events.map((e: any) => ({
      kind: e.kind as 'birthday' | 'anniversary',
      memberId: e.memberId ?? null,
      dateRule: e.dateRule,
      title: e.title,
    })),
  });
}

export async function logTriggerFire(
  spaceId: string,
  hit: TriggerHit,
  mealType: MealType,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.triggerLog.create({
    data: { spaceId, triggerId: hit.triggerId, sceneId: hit.sceneId, mealType },
  });
}
