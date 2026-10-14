'use client';

import { useEffect, useState } from 'react';
import { Coins, Snowflake, Sparkles } from 'lucide-react';
import { api } from '@/lib/types';
import { englishMessage } from '@/lib/messages-en';
import '@/app/points.css';

type Entry = { delta: number; reason: string; ref?: string; createdAt: number };
export type PointsSummary = {
  balance: number;
  ledger: Entry[];
  prices: { freeze: number; ai: number };
  rules: Record<string, number>;
  freezes: { boughtThisMonth: number; monthlyMax: number; purchased: number[] };
  ai: { bonus: number; packUses: number } | null;
};
const REASONS: Record<string, [string, string]> = {
  'ac-day': ['当天首次通过', 'First AC of the day'],
  'first-ac': ['首次通过一道题', 'First AC of a problem'],
  daily: ['每日一题', 'Daily problem'],
  streak: ['连续打卡 7 天', '7-day streak'],
  experience: ['面经投稿', 'Interview report'],
  upvote: ['题解获赞', 'Upvote on your solution'],
  freeze: ['兑换补签卡', 'Streak freeze'],
  'ai-pack': ['兑换 AI 次数', 'AI calls'],
};

/**
 * Points on ?view=progress (GET oj/points): balance, what earns them, the two things they
 * buy, and the latest entries. `onChange` hands back the summary after a purchase, so the
 * calendar can count a new freeze before the bootstrap refreshes.
 */
export function PointsPanel({ english, onChange }: { english: boolean; onChange?: (s: PointsSummary) => void }) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [data, setData] = useState<PointsSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let current = true;
    api<PointsSummary>('oj/points').then(
      (value) => {
        if (current) setData(value);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, []);
  if (!data) return null;
  async function redeem(item: 'freeze' | 'ai') {
    setBusy(true);
    setMessage('');
    try {
      const next = await api<PointsSummary>('oj/points/redeem', { item });
      setData(next);
      onChange?.(next);
      setMessage(
        item === 'freeze'
          ? t('已兑换 1 张补签卡，本月断签保护 +1。', 'One streak freeze added to this month.')
          : t(`已兑换 ${next.ai?.packUses ?? 5} 次 AI 调用。`, `${next.ai?.packUses ?? 5} AI calls added.`),
      );
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : '';
      setMessage(english ? englishMessage(text) : text);
    } finally {
      setBusy(false);
    }
  }
  const { rules, prices, freezes } = data;
  const freezeFull = freezes.boughtThisMonth >= freezes.monthlyMax;
  const date = (time: number) =>
    new Date(time).toLocaleDateString(english ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' });
  return (
    <section className="points-card" aria-labelledby="points-title">
      <div className="points-face">
        <p className="points-kicker">{t('积分卡', 'Points card')}</p>
        <h2 id="points-title" className="sr-only">
          {t('积分', 'Points')}
        </h2>
        <p className="points-balance">
          <Coins size={20} aria-hidden="true" />
          <strong>{data.balance}</strong>
          <span>{t('积分', 'points')}</span>
        </p>
        <ul className="points-rules">
          <li>{t(`当天首次 AC +${rules.acDay}`, `First AC of the day +${rules.acDay}`)}</li>
          <li>{t(`每日一题 +${rules.daily}`, `Daily problem +${rules.daily}`)}</li>
          <li>
            {t(
              `新题首次 AC +${rules.firstAc}（每天最多 ${rules.firstAcCap}）`,
              `A problem’s first AC +${rules.firstAc} (up to ${rules.firstAcCap} a day)`,
            )}
          </li>
          <li>{t(`连续 7 天 +${rules.streak}`, `Every 7 days in a row +${rules.streak}`)}</li>
          <li>{t(`面经通过审核 +${rules.experience}`, `Approved interview report +${rules.experience}`)}</li>
          <li>
            {t(
              `题解每个赞 +${rules.upvote}（每天最多 ${rules.upvoteCap}）`,
              `Each upvote on a solution +${rules.upvote} (up to ${rules.upvoteCap} a day)`,
            )}
          </li>
        </ul>
      </div>
      <div className="points-shop">
        <button
          type="button"
          className="points-redeem"
          disabled={busy || freezeFull || data.balance < prices.freeze}
          onClick={() => void redeem('freeze')}
        >
          <Snowflake size={16} aria-hidden="true" />
          <span>
            <strong>{t('补签卡', 'Streak freeze')}</strong>
            <small>
              {t(
                `${prices.freeze} 分 · 本月已兑 ${freezes.boughtThisMonth}/${freezes.monthlyMax}`,
                `${prices.freeze} pts · ${freezes.boughtThisMonth}/${freezes.monthlyMax} this month`,
              )}
            </small>
          </span>
        </button>
        {data.ai && (
          <button
            type="button"
            className="points-redeem"
            disabled={busy || data.balance < prices.ai}
            onClick={() => void redeem('ai')}
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>
              <strong>{t(`AI 助教 ${data.ai.packUses} 次`, `${data.ai.packUses} AI tutor calls`)}</strong>
              <small>
                {t(`${prices.ai} 分 · 剩余 ${data.ai.bonus} 次`, `${prices.ai} pts · ${data.ai.bonus} left`)}
              </small>
            </span>
          </button>
        )}
        <p className="points-message" role="status">
          {message}
        </p>
      </div>
      <div className="points-ledger">
        <h3>{t('最近记录', 'Recent entries')}</h3>
        {data.ledger.length ? (
          <ol>
            {data.ledger.map((entry, i) => (
              <li key={`${entry.createdAt}-${i}`}>
                <span>
                  {t(...(REASONS[entry.reason] ?? (['其他', 'Other'] as const)))}
                  {entry.delta < 0 && entry.reason === 'experience' && t('（下架扣回）', ' (taken back)')}
                </span>
                <time dateTime={new Date(entry.createdAt).toISOString()}>{date(entry.createdAt)}</time>
                <strong data-sign={entry.delta > 0 ? '+' : '-'}>
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <p>{t('通过第一道题就有积分了。', 'Solve your first problem to earn points.')}</p>
        )}
      </div>
    </section>
  );
}
