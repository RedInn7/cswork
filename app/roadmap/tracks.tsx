'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { RouteGraph, type StopProgress } from '@/components/route-graph';
import { ojRequest } from '@/lib/oj-client';
import type { RouteSectionInput } from '@/lib/route-stops';

export type SdPart = 'framework' | 'blocks' | 'cases' | 'lld' | 'concurrency' | 'ml';
const PARTS: [SdPart, string, string][] = [
  ['framework', '答题框架', 'Framework'],
  ['blocks', '基本构件', 'Building blocks'],
  ['cases', '经典案例', 'Case studies'],
  ['lld', '面向对象设计（LLD）', 'Low-level design'],
  ['concurrency', '并发', 'Concurrency'],
  ['ml', 'ML 系统设计', 'ML system design'],
];
type Link = { title: string; href: string };

/**
 * /roadmap's three tracks. The server renders them with Line 500's totals; the learner's
 * progress comes from the APIs the bank already uses (the list, and read marks that
 * app/system-design writes as `sd:<slug>`). Guests keep the plain map.
 */
export function RoadmapTracks({
  english,
  totals,
  sd,
  guide,
}: {
  english: boolean;
  totals: StopProgress;
  sd: (Link & { slug: string; part: SdPart })[];
  guide: (Link & { summary: string })[];
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [progress, setProgress] = useState(totals);
  const [member, setMember] = useState(false);
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const controller = new AbortController();
    ojRequest<{ collection?: { sections: RouteSectionInput[] } }>('library', undefined, controller.signal)
      .then((data) => {
        if (data.collection)
          setProgress(
            Object.fromEntries(
              data.collection.sections.map((s) => [s.slug, { solved: s.solved, total: s.total }]),
            ),
          );
      })
      .catch(() => {});
    // Signed out this answers 401: the page stays a guest's.
    ojRequest<{ items: { target: string }[] }>('marks?mark=read', undefined, controller.signal)
      .then((data) => {
        setMember(true);
        setRead(new Set(data.items.map((item) => item.target)));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const readCount = sd.filter((chapter) => read.has(`sd:${chapter.slug}`)).length;
  return (
    <div className="roadmap-tracks">
      <section className="roadmap-track" aria-labelledby="roadmap-coding">
        <h2 id="roadmap-coding">
          <span className="roadmap-track-no">1</span>
          {t('编码：35 个知识点', 'Coding: 35 topics')}
        </h2>
        <p className="roadmap-lead">
          {t(
            '从左到右是建议的学习顺序，连线指向依赖它的知识点。点一站就去练这一站的题。状态只是建议，任何一站都可以直接开始。',
            'Left to right is the suggested order; each line leads to a topic that builds on it. Pick a stop to practise its problems. States are advice only: every stop is open.',
          )}
        </p>
        <RouteGraph progress={progress} member={member} english={english} />
        {member ? (
          <ul className="roadmap-legend" aria-label={t('图例', 'Legend')}>
            <li data-state="done">{t('已完成（通过 80% 以上）', 'Done (80%+ solved)')}</li>
            <li data-state="active">{t('进行中', 'In progress')}</li>
            <li data-state="ready">{t('可以开始（先修都过了 60%）', 'Ready (prerequisites at 60%+)')}</li>
            <li data-state="later">{t('建议先学前面的', 'Learn its prerequisites first')}</li>
          </ul>
        ) : (
          <p className="roadmap-note">{t('登录后，每一站会显示你的进度和建议。', 'Sign in to see your progress and advice on every stop.')}</p>
        )}
      </section>

      <section className="roadmap-track" aria-labelledby="roadmap-sd">
        <h2 id="roadmap-sd">
          <span className="roadmap-track-no">2</span>
          {t(`系统设计：${sd.length} 章`, `System design: ${sd.length} chapters`)}
        </h2>
        <p className="roadmap-lead">
          {member
            ? t(`已读 ${readCount} / ${sd.length} 章。`, `${readCount} of ${sd.length} chapters read.`)
            : t('先学答题框架和基本构件，再做案例，然后是面向对象设计和并发，最后是 ML 系统设计。', 'Start with the framework and building blocks, then the case studies, then low-level design and concurrency, and finally ML system design.')}
        </p>
        <ol className="roadmap-parts">
          {PARTS.map(([part, zh, en]) => {
            const chapters = sd.filter((chapter) => chapter.part === part);
            return chapters.length ? (
              <li key={part}>
                <h3>{t(zh, en)}</h3>
                <ol>
                  {chapters.map((chapter) => {
                    const done = read.has(`sd:${chapter.slug}`);
                    return (
                      <li key={chapter.slug} data-read={done || undefined}>
                        <a href={chapter.href}>
                          {done && <Check size={14} aria-hidden="true" />}
                          {chapter.title}
                          {done && <span className="sr-only">{t('（已读）', ' (read)')}</span>}
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ) : null;
          })}
        </ol>
      </section>

      <section className="roadmap-track" aria-labelledby="roadmap-behavioral">
        <h2 id="roadmap-behavioral">
          <span className="roadmap-track-no">3</span>
          {t('行为面试', 'Behavioral')}
        </h2>
        <ul className="roadmap-cards">
          {guide.map((chapter) => (
            <li key={chapter.href}>
              <a href={chapter.href}>
                <strong>{chapter.title}</strong>
                <span>{chapter.summary}</span>
              </a>
            </li>
          ))}
          <li>
            <a href="/?view=stories">
              <strong>{t('STAR 故事库', 'STAR story bank')}</strong>
              <span>
                {t(
                  '把经历写成 STAR 故事，对照常见行为题逐一准备，需要登录。',
                  'Write your experiences as STAR stories and match them to common behavioral questions. Requires sign-in.',
                )}
              </span>
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
