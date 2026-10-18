import { readLocale } from './i18n';
import type { Card } from './recall-cards';

/**
 * Saves a card as its note `card:<id>`; an empty body removes it. The server's message on failure.
 * Apart from components/card-editor.tsx (its dialog and review styles) so the resume builder's
 * question cards (components/resume-extend.tsx) save through it without loading them.
 */
export async function putCard(id: string, card: Card | null, t: (zh: string, en: string) => string) {
  const response = await fetch(`/api/oj/notes?target=card:${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Locale': readLocale() },
    body: JSON.stringify({ body: card ? JSON.stringify(card) : '' }),
  }).catch(() => null);
  if (response?.ok) return '';
  if (response?.status === 401) return t('登录后才能保存卡片。', 'Sign in to save cards.');
  const error = await response?.json().then((r: { error?: unknown }) => r?.error, () => null);
  return typeof error === 'string' && error ? error : t('没能保存，请稍后再试。', "Couldn't save. Try again in a moment.");
}
