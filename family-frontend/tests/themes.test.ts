import { describe, expect, it } from 'vitest';
import {
  getDefaultTheme,
  getThemes,
  pickThemeKey,
  themeFromKey,
  themeFromTriggerInfo,
} from '../src/theme/themes';

describe('themes', () => {
  it('default theme is the "default" key with empty decorations', () => {
    const t = getDefaultTheme();
    expect(t.key).toBe('default');
    expect(t.decor).toEqual([]);
  });

  it('exposes all 9 theme variants', () => {
    expect(getThemes().length).toBeGreaterThanOrEqual(9);
  });

  it('themeFromKey falls back to default for unknown keys', () => {
    expect(themeFromKey(undefined).key).toBe('default');
    expect(themeFromKey(null).key).toBe('default');
    // bypass the type narrowing on purpose to cover the runtime guard
    expect(themeFromKey('not_a_real_theme' as never).key).toBe('default');
  });

  it('pickThemeKey honors primary scene over overlays', () => {
    const k = pickThemeKey(
      { sceneId: 'scene_midautumn_dinner_v1' },
      [{ sceneId: 'scene_weather_rain_overlay_v1' }],
    );
    expect(k).toBe('midautumn');
  });

  it('pickThemeKey falls back to overlay when no primary', () => {
    const k = pickThemeKey(null, [{ sceneId: 'scene_weather_snow_overlay_v1' }]);
    expect(k).toBe('snow');
  });

  it('pickThemeKey returns default when nothing matches', () => {
    const k = pickThemeKey(null, []);
    expect(k).toBe('default');
  });

  it('themeFromTriggerInfo parses a session triggerInfo blob', () => {
    const json = JSON.stringify({
      primary: { triggerId: 'holiday_spring_festival_eve', sceneId: 'scene_spring_festival_eve_v1' },
      overlays: [],
    });
    expect(themeFromTriggerInfo(json).key).toBe('spring_festival');
  });

  it('themeFromTriggerInfo tolerates malformed input', () => {
    expect(themeFromTriggerInfo('not json').key).toBe('default');
    expect(themeFromTriggerInfo(null).key).toBe('default');
    expect(themeFromTriggerInfo(undefined).key).toBe('default');
  });
});
