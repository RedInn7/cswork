'use client';
import { useId, useState } from 'react';
import { readLocale, useT } from '@/lib/i18n';
import { RECALL_CARDS } from '@/lib/recall';
import { CARD_TEXT_MAX, newCardId, parseCard, splitTags, type Card } from '@/lib/recall-cards';
import { updateRecall } from './recall-rate';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

/** Saves a card as its note `card:<id>`; an empty body removes it. The server's message on failure. */
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

/**
 * A self-made review card in a dialog: front, back and tags, saved to the account; `id` edits a
 * saved card and can delete it, which also takes it out of the review queue (RECALL_CARDS). A new
 * card is due in the review session (components/review-session.tsx) right away.
 */
export function CardEditor({
  id,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: {
  id?: string;
  initial: { front: string; back: string; tags?: string[]; src?: Card['src'] };
  onClose: () => void;
  onSaved?: (id: string, card: Card) => void;
  onDeleted?: (id: string) => void;
}) {
  const t = useT();
  const field = useId();
  const [front, setFront] = useState(initial.front.slice(0, CARD_TEXT_MAX));
  const [back, setBack] = useState(initial.back.slice(0, CARD_TEXT_MAX));
  const [tags, setTags] = useState((initial.tags ?? []).join(' '));
  const [saved, setSaved] = useState(id ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const card: Card = { v: 1, front: front.trim(), back: back.trim(), tags: splitTags(tags), ...(initial.src && { src: initial.src }) };

  async function save() {
    if (!parseCard(JSON.stringify(card)))
      return setMessage({ error: true, text: t('正面不能为空，正反面各最多 2000 字。', 'The front is required; each side holds up to 2,000 characters.') });
    const key = saved || newCardId();
    setBusy(true);
    const error = await putCard(key, card, t);
    setBusy(false);
    if (error) return setMessage({ error: true, text: error });
    setSaved(key);
    onSaved?.(key, card);
    setMessage({ error: false, text: t('已保存。新卡今天就会出现在「今日复习」里。', 'Saved. A new card shows up in the review session today.') });
  }
  async function remove() {
    setBusy(true);
    const error = await putCard(saved, null, t);
    if (!error)
      await updateRecall(
        true,
        (queue) => ({ v: 1, items: Object.fromEntries(Object.entries(queue.items).filter(([key]) => key !== `card:${saved}`)) }),
        RECALL_CARDS,
      );
    setBusy(false);
    if (error) return setMessage({ error: true, text: error });
    onDeleted?.(saved);
    onClose();
  }

  const count = (text: string) => `${[...text].length} / ${CARD_TEXT_MAX}`;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{saved ? t('编辑记忆卡', 'Edit card') : t('新建记忆卡', 'New card')}</DialogTitle>
          <DialogDescription>
            {t(
              '正面写问题，背面写答案或要点。卡片只有你能看到，按 1、3、7、21 天的间隔回来复习。',
              'Ask on the front, answer on the back. Only you see your cards; they come back after 1, 3, 7 and 21 days.',
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="grid gap-1 text-sm font-medium" htmlFor={`${field}-front`}>
            <span className="flex justify-between">
              {t('正面', 'Front')}
              <small className="font-normal text-muted-foreground">{count(front)}</small>
            </span>
            <Textarea id={`${field}-front`} value={front} maxLength={CARD_TEXT_MAX} required onChange={(e) => setFront(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium" htmlFor={`${field}-back`}>
            <span className="flex justify-between">
              {t('背面', 'Back')}
              <small className="font-normal text-muted-foreground">{count(back)}</small>
            </span>
            <Textarea id={`${field}-back`} value={back} maxLength={CARD_TEXT_MAX} className="max-h-64" onChange={(e) => setBack(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium" htmlFor={`${field}-tags`}>
            {t('标签（空格分隔，最多 8 个）', 'Tags (space separated, up to 8)')}
            <Input id={`${field}-tags`} value={tags} placeholder="dp graph" onChange={(e) => setTags(e.target.value)} />
          </label>
          {initial.src && (
            <p className="text-sm text-muted-foreground">
              {t('来源：', 'From: ')}
              <a className="underline" href={initial.src.href}>
                {initial.src.title || initial.src.href}
              </a>
            </p>
          )}
          <p role={message?.error ? 'alert' : 'status'} className={message?.error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {message?.text}
            {message && !message.error && (
              <>
                {' '}
                <a className="underline" href="/?view=review-session">
                  {t('去复习', 'Open the review session')}
                </a>
              </>
            )}
          </p>
          <DialogFooter>
            {saved && (
              <Button type="button" variant="outline" className="sm:mr-auto" disabled={busy} onClick={() => void remove()}>
                {t('删除', 'Delete')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {t('关闭', 'Close')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t('正在保存…', 'Saving…') : t('保存', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
