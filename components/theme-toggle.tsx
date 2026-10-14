'use client';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { setThemePreference, useThemePreference } from '@/lib/theme';
import type { ThemePreference } from '@/lib/theme-script';

const ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const ICONS = { system: Monitor, light: Sun, dark: Moon };

/** Header button: cycles follow-the-system → light → dark. */
export function ThemeToggle() {
  const t = useT();
  const preference = useThemePreference();
  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
  const names: Record<ThemePreference, string> = {
    system: t('跟随系统', 'System'),
    light: t('浅色', 'Light'),
    dark: t('深色', 'Dark'),
  };
  const Icon = ICONS[preference];
  const label = t(
    `外观：${names[preference]}，点击切换为${names[next]}`,
    `Theme: ${names[preference]}. Switch to ${names[next]}`,
  );
  return (
    <Button
      size="icon"
      variant="ghost"
      className="theme-toggle"
      aria-label={label}
      title={label}
      data-preference={preference}
      onClick={() => setThemePreference(next)}
    >
      <Icon size={17} aria-hidden="true" />
    </Button>
  );
}
