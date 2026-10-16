'use client';

import { useEffect, useState } from 'react';
import { RatingBadge } from './rating-badge';
import { api } from '@/lib/types';
import type { LevelTier } from '@/lib/lc-rating';

/** estimated: an OA problem, rated by its difficulty (lib/server/oa-rating.ts); its number is per company. */
type Pick = { id: string; number: number; titleZh: string; titleEn: string; rating: number; chance: number; estimated?: boolean };
type Picks = {
  level: number;
  samples: number;
  tiers: { tier: LevelTier; from: number; to: number; items: Pick[] }[];
};
const TIERS: Record<LevelTier, [string, string]> = {
  easy: ['稳拿', 'Easy'],
  moderate: ['够一够', 'Moderate'],
  hard: ['挑战', 'Difficult'],
};

/**
 * "Problems at your level" (GET oj/recommend): the level is the median rating of the
 * latest 30 rated ACs, each tier offers three unsolved judgeable problems with the Elo
 * chance of solving them. Renders nothing signed out or when the request fails.
 * `navigate` opens a problem in the app; without it (the /daily page) the links load it.
 */
export function LevelPicks({
  english,
  navigate,
}: {
  english: boolean;
  navigate?: (view: 'problem', params: { problem: string }) => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [picks, setPicks] = useState<Picks | null>(null);
  useEffect(() => {
    let current = true;
    api<Picks>('oj/recommend').then(
      (value) => {
        if (current) setPicks(value);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, []);
  if (!picks || !picks.tiers.some((tier) => tier.items.length)) return null;
  return (
    <section className="level-picks" aria-labelledby="level-picks-title">
      <div className="level-picks-head">
        <h2 id="level-picks-title">{t('适合你的下一题', 'Problems at your level')}</h2>
        <p>
          {t('你的水平', 'Your level')} <span className="level-picks-level">{picks.level}</span>{' '}
          {picks.samples
            ? t(
                `· 最近 ${picks.samples} 道有难度分的 AC 题的中位数`,
                `· median of your latest ${picks.samples} rated ${picks.samples === 1 ? 'AC' : 'ACs'}`,
              )
            : t('· 还没有带难度分的 AC，先从这里起步', '· no rated AC yet, so this is a starting point')}
        </p>
      </div>
      <div className="level-picks-tiers">
        {picks.tiers.map((tier) => (
          <div className="level-tier" key={tier.tier}>
            <h3>
              {t(...TIERS[tier.tier])}
              <small>
                {tier.from}–{tier.to}
              </small>
            </h3>
            {tier.items.length ? (
              <ol>
                {tier.items.map((item) => {
                  const href = `/?${new URLSearchParams({ view: 'problem', problem: item.id })}`;
                  return (
                    <li key={item.id}>
                      <a
                        className="level-pick"
                        href={href}
                        onClick={(event) => {
                          if (!navigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                          event.preventDefault();
                          navigate('problem', { problem: item.id });
                        }}
                      >
                        <strong>
                          {!item.estimated && `${item.number}. `}
                          {(english ? item.titleEn : item.titleZh) || item.titleEn || item.titleZh}
                        </strong>
                        <RatingBadge rating={item.rating} estimated={item.estimated} english={english} />
                        <span className="level-pick-chance">
                          {t(`预计解出 ${item.chance}%`, `${item.chance}% to solve`)}
                          <meter min={0} max={100} value={item.chance} aria-hidden="true" />
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="level-tier-empty">{t('这一档暂时没有未通过的题。', 'Nothing unsolved in this range yet.')}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
