import { ref, watchEffect, onBeforeUnmount } from 'vue';
import {
  applyThemeToRoot,
  getDefaultTheme,
  themeFromTriggerInfo,
  type Theme,
} from './themes';

/**
 * useTheme — reactive theme cell that any page can apply to <html>.
 *
 * Pages set the theme by mutating the returned ref (or calling `setFromTriggerInfo`),
 * and the composable mirrors it onto the document root as CSS custom properties.
 * On unmount the root is reset to the default theme so other pages don't inherit
 * an unrelated festival skin.
 */
export function useTheme(initial?: Theme) {
  const theme = ref<Theme>(initial ?? getDefaultTheme());

  function setFromTriggerInfo(info: string | null | undefined): void {
    theme.value = themeFromTriggerInfo(info);
  }

  function reset(): void {
    theme.value = getDefaultTheme();
  }

  watchEffect(() => {
    if (typeof document !== 'undefined') {
      applyThemeToRoot(theme.value);
    }
  });

  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') {
      applyThemeToRoot(getDefaultTheme());
    }
  });

  return { theme, setFromTriggerInfo, reset };
}
