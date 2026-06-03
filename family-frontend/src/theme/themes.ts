// V0.2 Festival / scene theme registry.
//
// Backend (server/src/services/triggers.ts) emits a sceneId on dinner.start
// and stores it on dinnerSession.triggerInfo. The frontend maps scene/trigger
// ids to a "theme key" and a renderable theme object. The chosen design is to
// keep the theme registry on the frontend so we can iterate visuals without
// shipping backend changes; the backend stays the single source of truth for
// when a theme is active.

export type ThemeKey =
  | 'default'
  | 'spring_festival'
  | 'lantern'
  | 'dragon_boat'
  | 'midautumn'
  | 'dongzhi'
  | 'birthday'
  | 'rain'
  | 'snow';

export interface ThemeTokens {
  /** Main accent (used for hero gradient + dish glow). */
  primary: string;
  /** Secondary accent for outlines / pill borders. */
  accent: string;
  /** Sky gradient top -> bottom for the dining stage background. */
  skyTop: string;
  skyBottom: string;
  /** Floor strip color of the stage. */
  floor: string;
  /** Card surface tint laid over the page. */
  surface: string;
}

export interface ThemeDecor {
  /** Emoji or short string for floating decorations on the stage. */
  symbol: string;
  /** How many decoration nodes to render. */
  count: number;
  /**
   * Where decorations float visually:
   *   - "ceiling": hang from top
   *   - "window":  cluster on the left window pane (春联/窗花)
   *   - "sky":     drift across upper half (月亮 / 雪)
   */
  zone: 'ceiling' | 'window' | 'sky';
}

export interface Theme {
  key: ThemeKey;
  /** Short Chinese label shown in the scene header chip. */
  label: string;
  /** One-line caption explaining what's going on (打开场景的小提示). */
  caption: string;
  tokens: ThemeTokens;
  decor: ThemeDecor[];
  /** Optional override for dish emojis on the table (defaults stay if omitted). */
  dishes?: [string, string, string, string];
}

const DEFAULT_THEME: Theme = {
  key: 'default',
  label: '日常家常',
  caption: '今天没有特别的节日，吃点家常的就好。',
  tokens: {
    primary: '#f08a6a',
    accent: '#c47c2c',
    skyTop: '#ffe7c2',
    skyBottom: '#f3b97a',
    floor: '#c79055',
    surface: '#fff7ec',
  },
  decor: [],
};

const THEMES: Record<ThemeKey, Theme> = {
  default: DEFAULT_THEME,
  spring_festival: {
    key: 'spring_festival',
    label: '春节',
    caption: '客厅挂了灯笼，桌上有饺子。',
    tokens: {
      primary: '#c8102e',
      accent: '#e2b53b',
      skyTop: '#ffd6c2',
      skyBottom: '#e26a4c',
      floor: '#9c4a30',
      surface: '#fff1ec',
    },
    decor: [
      { symbol: '🏮', count: 4, zone: 'ceiling' },
      { symbol: '🧧', count: 2, zone: 'window' },
    ],
    dishes: ['🥟', '🐟', '🍊', '🍚'],
  },
  lantern: {
    key: 'lantern',
    label: '元宵',
    caption: '汤圆煮好了，咸甜都有。',
    tokens: {
      primary: '#f08c3e',
      accent: '#e2b53b',
      skyTop: '#ffe5c2',
      skyBottom: '#f0aa4c',
      floor: '#a86a3a',
      surface: '#fff5e8',
    },
    decor: [
      { symbol: '🏮', count: 3, zone: 'ceiling' },
      { symbol: '🌕', count: 1, zone: 'sky' },
    ],
    dishes: ['🍡', '🥣', '🍵', '🍊'],
  },
  dragon_boat: {
    key: 'dragon_boat',
    label: '端午',
    caption: '蒸笼里是粽子，咸甜都备着。',
    tokens: {
      primary: '#527a4d',
      accent: '#a8b87a',
      skyTop: '#e7f1d8',
      skyBottom: '#9bbf6e',
      floor: '#7c6a3a',
      surface: '#f4f7e8',
    },
    decor: [
      { symbol: '🍃', count: 4, zone: 'ceiling' },
      { symbol: '🎏', count: 1, zone: 'window' },
    ],
    dishes: ['🥮', '🥚', '🍵', '🍚'],
  },
  midautumn: {
    key: 'midautumn',
    label: '中秋',
    caption: '月亮升起来了，月饼切了。',
    tokens: {
      primary: '#1f2a44',
      accent: '#ede8dc',
      skyTop: '#1f2a44',
      skyBottom: '#3b4870',
      floor: '#5a4a3a',
      surface: '#f7f3ea',
    },
    decor: [
      { symbol: '🌕', count: 1, zone: 'sky' },
      { symbol: '🌸', count: 3, zone: 'ceiling' },
    ],
    dishes: ['🥮', '🍵', '🍊', '🍚'],
  },
  dongzhi: {
    key: 'dongzhi',
    label: '冬至',
    caption: '热汤上桌，外面冷里面暖。',
    tokens: {
      primary: '#9c6d4a',
      accent: '#c8102e',
      skyTop: '#dfe8ef',
      skyBottom: '#9aaab8',
      floor: '#9c6d4a',
      surface: '#fbf3ea',
    },
    decor: [
      { symbol: '🥟', count: 3, zone: 'ceiling' },
    ],
    dishes: ['🥟', '🍲', '🍵', '🥬'],
  },
  birthday: {
    key: 'birthday',
    label: '生日',
    caption: '今天是寿星的日子，别忘了许愿。',
    tokens: {
      primary: '#e85d8a',
      accent: '#e2b53b',
      skyTop: '#ffe6f0',
      skyBottom: '#e89bb8',
      floor: '#a36a55',
      surface: '#fff3f7',
    },
    decor: [
      { symbol: '🎈', count: 4, zone: 'ceiling' },
      { symbol: '🎁', count: 2, zone: 'window' },
    ],
    dishes: ['🎂', '🍜', '🍰', '🍇'],
  },
  rain: {
    key: 'rain',
    label: '下雨',
    caption: '玻璃上有雨痕，记得收衣服。',
    tokens: {
      primary: '#6b7c8c',
      accent: '#a4b8c8',
      skyTop: '#cbd6df',
      skyBottom: '#7d8a99',
      floor: '#8a7a5e',
      surface: '#eef3f8',
    },
    decor: [
      { symbol: '💧', count: 6, zone: 'sky' },
      { symbol: '☔', count: 1, zone: 'window' },
    ],
  },
  snow: {
    key: 'snow',
    label: '下雪',
    caption: '窗外飘着雪，桌上的汤更香了。',
    tokens: {
      primary: '#6f8caf',
      accent: '#dfe8ef',
      skyTop: '#f2f5f8',
      skyBottom: '#cdd9e3',
      floor: '#9c8c78',
      surface: '#f5f8fb',
    },
    decor: [
      { symbol: '❄', count: 8, zone: 'sky' },
      { symbol: '🧣', count: 1, zone: 'window' },
    ],
  },
};

export function getThemes(): Theme[] {
  return Object.values(THEMES);
}

export function getDefaultTheme(): Theme {
  return THEMES.default;
}

export function themeFromKey(key: ThemeKey | undefined | null): Theme {
  if (key && THEMES[key]) return THEMES[key];
  return DEFAULT_THEME;
}

const SCENE_TO_THEME: Record<string, ThemeKey> = {
  scene_spring_festival_eve_v1: 'spring_festival',
  scene_spring_festival_day_v1: 'spring_festival',
  scene_lantern_v1: 'lantern',
  scene_dragon_boat_v1: 'dragon_boat',
  scene_midautumn_dinner_v1: 'midautumn',
  scene_dongzhi_v1: 'dongzhi',
  scene_birthday_v1: 'birthday',
  scene_weather_rain_overlay_v1: 'rain',
  scene_weather_snow_overlay_v1: 'snow',
};

export interface TriggerLike {
  triggerId?: string;
  sceneId?: string;
}

export function pickThemeKey(
  primary: TriggerLike | null | undefined,
  overlays: TriggerLike[] | null | undefined,
): ThemeKey {
  if (primary?.sceneId && SCENE_TO_THEME[primary.sceneId]) {
    return SCENE_TO_THEME[primary.sceneId];
  }
  // Fall back to overlay theme (rain/snow) if there's no primary.
  if (overlays && overlays.length > 0) {
    for (const o of overlays) {
      if (o?.sceneId && SCENE_TO_THEME[o.sceneId]) return SCENE_TO_THEME[o.sceneId];
    }
  }
  return 'default';
}

/**
 * Parse a dinnerSession.triggerInfo JSON blob (string from backend) and pick
 * a theme. Tolerant of nulls / malformed values.
 */
export function themeFromTriggerInfo(raw: string | null | undefined): Theme {
  if (!raw) return DEFAULT_THEME;
  try {
    const parsed = JSON.parse(raw) as {
      primary?: TriggerLike | null;
      overlays?: TriggerLike[] | null;
    };
    return themeFromKey(pickThemeKey(parsed.primary ?? null, parsed.overlays ?? []));
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Apply theme tokens to the document root as CSS custom properties so any
 * page that opts in (`var(--theme-primary)`) can react.
 */
export function applyThemeToRoot(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--theme-primary', theme.tokens.primary);
  root.style.setProperty('--theme-accent', theme.tokens.accent);
  root.style.setProperty('--theme-sky-top', theme.tokens.skyTop);
  root.style.setProperty('--theme-sky-bottom', theme.tokens.skyBottom);
  root.style.setProperty('--theme-floor', theme.tokens.floor);
  root.style.setProperty('--theme-surface', theme.tokens.surface);
  root.dataset.theme = theme.key;
}
