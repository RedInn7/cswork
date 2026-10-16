'use client';

import { useT } from '@/lib/i18n';
import { delivery, type Segment } from '@/lib/mock-delivery';

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Pace, fillers, time spoken against the plan and the longest pause, for dictated answers. */
export function DeliveryStats({ segments, minutes, title }: { segments: readonly Segment[]; minutes: number; title: string }) {
  const t = useT();
  const d = delivery(segments);
  if (!d) return null;
  return (
    <div className="mi-delivery">
      <h3>{title}</h3>
      <dl>
        <div>
          <dt>{t('语速', 'Pace')}</dt>
          <dd>{d.perMinute === null ? '—' : t(`${d.perMinute} 字/分钟`, `${d.perMinute} words/min`)}</dd>
        </div>
        <div>
          <dt>{t('口头禅', 'Fillers')}</dt>
          <dd>{t(`${d.fillers} 次`, `${d.fillers}`)}</dd>
        </div>
        <div>
          <dt>{t('说话 / 计划', 'Spoken / planned')}</dt>
          <dd>
            {mmss(d.spokenSec)} / {mmss(minutes * 60)}
          </dd>
        </div>
        <div>
          <dt>{t('最长停顿', 'Longest pause')}</dt>
          <dd>{mmss(d.longestPauseSec)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** The AI interview summary's delivery section: each dictated question, then the whole interview. */
export function DeliveryReport({ slots, speech }: { slots: { minutes: number }[]; speech?: Record<number, Segment[]> }) {
  const t = useT();
  const asked = slots.flatMap((slot, i) => {
    const segments = speech?.[i];
    return segments?.length ? [{ i, slot, segments }] : [];
  });
  if (!asked.length) return null;
  return (
    <section className="rd-card mi-ai-extras" aria-labelledby="mi-delivery-title">
      <h2 id="mi-delivery-title">{t('语音表达', 'How you spoke')}</h2>
      {asked.length > 1 && (
        <DeliveryStats
          title={t('整场', 'Whole interview')}
          segments={asked.flatMap((a) => a.segments)}
          minutes={slots.reduce((n, s) => n + s.minutes, 0)}
        />
      )}
      {asked.map(({ i, slot, segments }) => (
        <DeliveryStats key={i} title={t(`第 ${i + 1} 题`, `Question ${i + 1}`)} segments={segments} minutes={slot.minutes} />
      ))}
      <p className="mi-ai-privacy">
        {t(
          '只统计语音输入的部分。口头禅数“嗯、那个、就是、然后”和 um、uh、like、you know、basically；这些数字只在这台设备上计算和保存，不会上传。',
          'Dictated answers only. Fillers counted: um, uh, like, you know, basically (and 嗯, 那个, 就是, 然后 in Chinese). These numbers are worked out and kept on this device, never uploaded.',
        )}
      </p>
    </section>
  );
}
