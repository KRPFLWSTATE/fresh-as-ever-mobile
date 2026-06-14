import type { ResolvedColorScheme } from '@/theme/StitchThemeContext';
import type { StitchTextColorKey } from '@/ui/stitch/StitchText';

/** Readable label/body text on teal/green highlight surfaces (primaryHighlight, primaryContainer). */
export function textOnGreenSurface(
  mode: ResolvedColorScheme,
  lightKey: StitchTextColorKey = 'primary',
): StitchTextColorKey {
  return mode === 'dark' ? 'onPrimary' : lightKey;
}

/** Headline text on teal/green highlight surfaces. */
export function headlineOnGreenSurface(
  mode: ResolvedColorScheme,
  lightKey: StitchTextColorKey = 'primaryContainer',
): StitchTextColorKey {
  return mode === 'dark' ? 'onPrimary' : lightKey;
}
