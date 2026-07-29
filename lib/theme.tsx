// lib/theme.tsx
//
// Independent from Home Base / League Base's theme setup by design -
// confirmed this should not be shared across the three apps.

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getSettings, saveSettings } from './storage';
import { AppSettings, DEFAULT_SETTINGS } from '../types/models';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string; // the user's raw chosen color - use ONLY for filled backgrounds (buttons, active chips, swatches)
  accentText: string; // text/icons placed ON TOP of a filled `accent` background
  accentReadable: string; // `accent` used as plain text/icon/border color directly on the screen background
  danger: string;
  success: string;
}

export interface Theme {
  mode: 'light' | 'dark';
  colors: ThemeColors;
  fontScale: number;
}

export const THEME_COLOR_OPTIONS: { name: string; hex: string }[] = [
  { name: 'Blue', hex: '#378ADD' },
  { name: 'Green', hex: '#639922' },
  { name: 'Purple', hex: '#7F77DD' },
  { name: 'Coral', hex: '#D85A30' },
  { name: 'Pink', hex: '#D4537E' },
  { name: 'Red', hex: '#E24B4A' },
  { name: 'Amber', hex: '#BA7517' },
  { name: 'Teal', hex: '#1D9E75' },
  { name: 'Brown', hex: '#8B5A2B' },
  { name: 'Indigo', hex: '#4F46E5' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
];

// --- WCAG contrast math ---

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Picks whichever of black/white has the higher real contrast ratio against the given fill. */
function contrastTextColor(hex: string): string {
  const withBlack = contrastRatio('#000000', hex);
  const withWhite = contrastRatio('#FFFFFF', hex);
  return withBlack >= withWhite ? '#000000' : '#FFFFFF';
}

function hexToHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r0:
        h = ((g0 - b0) / d) % 6;
        break;
      case g0:
        h = (b0 - r0) / d + 2;
        break;
      default:
        h = (r0 - g0) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Walks the accent color's HSL lightness toward the background until it
 * passes 4.5:1 (WCAG AA for text), preserving hue/saturation so e.g. a
 * "Yellow" pick still reads as yellow rather than falling back to a flat
 * black/white. This is what makes every one of the 10 theme colors -
 * including White and Black, which fail outright against a same-shade
 * background - actually readable as plain text/icon color in both modes.
 */
function accentReadableFor(accentHex: string, backgroundHex: string): string {
  if (contrastRatio(accentHex, backgroundHex) >= 4.5) return accentHex;
  const [h, s, l] = hexToHsl(accentHex);
  const bgIsLight = relativeLuminance(hexToRgb(backgroundHex)) > 0.5;
  for (let step = 1; step <= 25; step++) {
    const delta = step * 0.035;
    const newL = bgIsLight ? Math.max(0, l - delta) : Math.min(1, l + delta);
    const candidate = hslToHex(h, s, newL);
    if (contrastRatio(candidate, backgroundHex) >= 4.5) return candidate;
  }
  return bgIsLight ? '#000000' : '#FFFFFF';
}

function buildTheme(mode: 'light' | 'dark', accent: string, fontSize: AppSettings['fontSize']): Theme {
  const fontScale = fontSize === 'small' ? 0.9 : fontSize === 'large' ? 1.2 : 1;
  const background = mode === 'dark' ? '#17181A' : '#FFFFFF';
  const colorsBase =
    mode === 'dark'
      ? {
          background: '#17181A',
          surface: '#232427',
          text: '#EDEDEB',
          textSecondary: '#B4B2A9',
          textMuted: '#888780',
          border: '#3A3B3E',
          danger: '#F09595',
          success: '#97C459',
        }
      : {
          background: '#FFFFFF',
          surface: '#F4F3F0',
          text: '#1A1A18',
          textSecondary: '#5F5E5A',
          textMuted: '#888780',
          border: '#D3D1C7',
          danger: '#A32D2D',
          success: '#3B6D11',
        };

  const colors: ThemeColors = {
    ...colorsBase,
    accent,
    accentText: contrastTextColor(accent),
    accentReadable: accentReadableFor(accent, background),
  };

  return { mode, colors, fontScale };
}

interface ThemeContextValue {
  theme: Theme;
  settings: AppSettings;
  setThemeColor: (hex: string) => Promise<void>;
  setThemeMode: (mode: 'light' | 'dark') => Promise<void>;
  setFontSize: (size: AppSettings['fontSize']) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const refreshSettings = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const persist = useCallback(async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
  }, []);

  const setThemeColor = useCallback(
    (hex: string) => persist({ ...settings, themeColor: hex }),
    [persist, settings],
  );
  const setThemeMode = useCallback(
    (mode: 'light' | 'dark') => persist({ ...settings, themeMode: mode }),
    [persist, settings],
  );
  const setFontSize = useCallback(
    (size: AppSettings['fontSize']) => persist({ ...settings, fontSize: size }),
    [persist, settings],
  );

  const theme = useMemo(
    () => buildTheme(settings.themeMode, settings.themeColor, settings.fontSize),
    [settings.themeMode, settings.themeColor, settings.fontSize],
  );

  const value = useMemo(
    () => ({ theme, settings, setThemeColor, setThemeMode, setFontSize, refreshSettings }),
    [theme, settings, setThemeColor, setThemeMode, setFontSize, refreshSettings],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
