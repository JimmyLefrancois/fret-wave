/**
 * Registre des thèmes + application à chaud (docs/ARCHITECTURE.md §4.6, skill css-theme-systems).
 *  - une table, pas un `if` : ajouter un thème = une entrée ;
 *  - le thème par défaut reste sur `:root` sans attribut (premier rendu, valeur mémorisée inconnue) ;
 *  - les variables sont posées par `applyTheme` (source unique : `tokens.ts`), jamais recopiées en CSS.
 */
import { DAWN } from './dawn';
import { SYNTHWAVE } from './synthwave';
import { cssVars, type ThemeTokens } from './tokens';

export const THEMES: Readonly<Record<string, ThemeTokens>> = {
  synthwave: SYNTHWAVE,
  dawn: DAWN,
};

export const DEFAULT_THEME = 'synthwave';

export const THEME_LIST: readonly ThemeTokens[] = Object.values(THEMES);

export function getTheme(id: string | null | undefined): ThemeTokens {
  return (id && THEMES[id]) || THEMES[DEFAULT_THEME]!;
}

/** Applique un thème : variables CSS sur `<html>` + attribut `data-theme`. Idempotent, sans transition. */
export function applyTheme(root: HTMLElement, id: string): ThemeTokens {
  const theme = getTheme(id);
  for (const [k, v] of Object.entries(cssVars(theme))) root.style.setProperty(k, v);
  // `color-scheme` : contrôles natifs, barres de défilement et champs suivent le thème
  root.style.colorScheme = theme.scheme;
  if (theme.id === DEFAULT_THEME) delete root.dataset.theme;
  else root.dataset.theme = theme.id;
  return theme;
}
