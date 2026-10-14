'use client';
import { useState } from 'react';
import { Check, Copy, Gift, RefreshCw } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import type { CommerceOrder } from '@/lib/commerce-types';
import { Button } from './ui/button';
import type { Navigate } from './learning';
import '@/app/commerce.css';

/** The redeem page for a code; the code rides in the fragment so it never reaches a server log. */
export const giftLink = (code: string) => `${location.origin}/?view=gift#code=${code}`;
const codeFromHash = () => {
  try {
    return new URLSearchParams(location.hash.slice(1)).get('code') ?? '';
  } catch {
    return '';
  }
};

/** "Buy as a gift" next to a course's buy button: the same checkout, ending in a code. */
export function GiftButton({ courseId }: { courseId: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            location.assign((await api<{ url: string }>('checkout', { courseId, gift: true })).url);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <Gift size={14} aria-hidden="true" />
        {t('买来送人', 'Buy as a gift')}
      </Button>
      {error && (
        <small role="alert" className="error-text">
          {t(error, englishMessage(error))}
        </small>
      )}
    </>
  );
}

/** A gift order's code (for the buyer, while unused), its share link and what became of it. */
export function GiftBlock({ order, onChange }: { order: CommerceOrder; onChange: (order: CommerceOrder) => void }) {
  const t = useT(),
    locale = useLocale();
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const gift = order.gift!;
  const day = (ms: number) => new Date(ms).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US');
  const copy = (what: string, text: string) =>
    void navigator.clipboard?.writeText(text).then(
      () => setCopied(what),
      () => {},
    );
  return (
    <div className="commerce-gift">
      <p className="commerce-gift-title">
        <Gift size={15} aria-hidden="true" />
        {t('课程礼物', 'Course gift')}
      </p>
      {gift.revokedAt ? (
        <p>{t(`兑换码已在 ${day(gift.revokedAt)} 随退款作废。`, `The code was voided with the refund on ${day(gift.revokedAt)}.`)}</p>
      ) : gift.redeemedAt ? (
        <p>{t(`已在 ${day(gift.redeemedAt)} 被兑换。`, `Redeemed on ${day(gift.redeemedAt)}.`)}</p>
      ) : gift.code ? (
        <>
          <p>
            {t(
              '把兑换码或链接发给收礼人：对方登录后兑换，课程就开通在对方的账号上。只能用一次。',
              'Send the code or the link to the recipient: once signed in, they redeem it and the course unlocks on their account. It works once.',
            )}
          </p>
          <div className="commerce-gift-code">
            <code aria-label={t(`兑换码 ${gift.code}`, `Gift code ${gift.code}`)}>{gift.code}</code>
            <Button variant="outline" size="sm" onClick={() => copy('code', gift.code!)}>
              {copied === 'code' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'code' ? t('已复制', 'Copied') : t('复制兑换码', 'Copy code')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy('link', giftLink(gift.code!))}>
              {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'link' ? t('已复制', 'Copied') : t('复制兑换链接', 'Copy link')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  onChange(await api<CommerceOrder>(`gifts/${encodeURIComponent(order.id)}/reissue`, {}));
                  setCopied('');
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={14} />
              {t('作废并换新码', 'Void and get a new code')}
            </Button>
          </div>
          <p className="commerce-hint">
            {t('发错人或码泄露了？换新码后旧码立刻失效。', 'Sent to the wrong person, or leaked? A new code stops the old one at once.')}
          </p>
        </>
      ) : (
        <p>{t('付款确认后会在这里显示兑换码。', 'The code shows here once the payment is confirmed.')}</p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {t(error, englishMessage(error))}
        </p>
      )}
    </div>
  );
}

/** Redeem a gift code: the account page's form, and the ?view=gift page (code from #code=). */
export function RedeemGift({ onDone }: { onDone: (title: string) => void }) {
  const t = useT();
  const [code, setCode] = useState(codeFromHash);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="commerce-redeem"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const { title } = await api<{ title: string }>('gifts/redeem', { code: code.trim() });
          setCode('');
          onDone(title);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        <span>{t('兑换码', 'Gift code')}</span>
        <input
          value={code}
          maxLength={40}
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <Button type="submit" disabled={busy || !code.trim()}>
        <Gift size={15} aria-hidden="true" />
        {busy ? t('正在兑换…', 'Redeeming…') : t('兑换课程', 'Redeem')}
      </Button>
      {error && (
        <p role="alert" className="error-text">
          {t(error, englishMessage(error))}
        </p>
      )}
    </form>
  );
}

/** ?view=gift#code=…: the link a buyer sends. */
export function GiftRedeemPage({ navigate, refresh }: { navigate: Navigate; refresh: () => Promise<void> }) {
  const t = useT();
  const [done, setDone] = useState('');
  return (
    <section className="form-card commerce-account-card commerce-gift-page">
      <h1>
        <Gift size={20} aria-hidden="true" /> {t('兑换课程礼物', 'Redeem a course gift')}
      </h1>
      {done ? (
        <div role="status" className="notice commerce-success">
          <p>{t(`《${done}》已经开通在你的账号上。`, `“${done}” is now unlocked on your account.`)}</p>
          <Button onClick={() => navigate('courses')}>{t('去学习', 'Start learning')}</Button>
        </div>
      ) : (
        <>
          <p className="muted">
            {t('朋友送了你一门课？输入兑换码，课程会开通在当前登录的账号上。', 'Someone gave you a course? Enter the code and it unlocks on the account you’re signed in with.')}
          </p>
          <RedeemGift
            onDone={(title) => {
              // The code is spent: keep it out of the address bar and history.
              history.replaceState(null, '', '/?view=gift');
              setDone(title);
              void refresh();
            }}
          />
        </>
      )}
    </section>
  );
}
