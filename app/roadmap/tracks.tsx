'use client';

import { useEffect, useState } from 'react';
import { RouteGraph, type StopProgress } from '@/components/route-graph';
import { MCQ_TOPIC_NAMES } from '@/components/oa-mcq';
import { CS_NODES, csLayers, csMastery, csState, topicReview } from '@/lib/cs-track';
import { parseMcqReview, type McqReview } from '@/lib/mock-oa';
import { ojRequest } from '@/lib/oj-client';
import { emptyRecall, parseRecall, RECALL_NOTE, type RecallQueue } from '@/lib/recall';
import type { RouteSectionInput } from '@/lib/route-stops';

export type SdPart = 'framework' | 'blocks' | 'cases' | 'lld' | 'concurrency' | 'ml' | 'tech' | 'patterns' | 'lld-cases' | 'api';
type Link = { title: string; href: string };
/** The CS fundamentals track's server data: each subject's question count, each crash course's title and chapter keys (learnKey). */
export type CsTrackData = { totals: Record<string, number>; courses: Record<string, { title: string; keys: string[] }> };
const CS_LAYERS = csLayers();
const CS_STATE: Record<ReturnType<typeof csState>, [string, string]> = {
  done: ['已完成', 'Done'],
  active: ['进行中', 'In progress'],
  todo: ['未开始', 'Not started'],
};

/**
 * /roadmap's four tracks. The server renders them with Line 500's totals; the learner's
 * progress comes from the APIs the bank already uses (the list, and read marks that
 * app/system-design writes as `sd:<slug>`), and for the CS track the multiple-choice review and the
 * recall queue notes. Guests keep the plain map.
 */
export function RoadmapTracks({
  english,
  totals,
  sd,
  guide,
  cs,
}: {
  english: boolean;
  totals: StopProgress;
  sd: (Link & { slug: string; part: SdPart })[];
  guide: (Link & { summary: string })[];
  cs: CsTrackData;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [progress, setProgress] = useState(totals);
  const [member, setMember] = useState(false);
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  const [review, setReview] = useState<McqReview>({});
  const [recall, setRecall] = useState<RecallQueue>(emptyRecall);
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
        // Members only: the CS track's answers and review cards, from the notes the MCQ page and recall cards keep.
        const note = (target: string) =>
          ojRequest<{ body: string }>(`notes?target=${encodeURIComponent(target)}`, undefined, controller.signal);
        note('mcq:answers').then((n) => setReview(parseMcqReview(n.body)), () => {});
        note(RECALL_NOTE).then((n) => setRecall(parseRecall(n.body)), () => {});
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const topicName = (id: string) => (MCQ_TOPIC_NAMES[id] ? t(...MCQ_TOPIC_NAMES[id]) : id);
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

      <section className="roadmap-track" aria-labelledby="roadmap-behavioral">
        <h2 id="roadmap-behavioral">
          <span className="roadmap-track-no">2</span>
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
        </ul>
      </section>

      <section className="roadmap-track" aria-labelledby="roadmap-cs">
        <h2 id="roadmap-cs">
          <span className="roadmap-track-no">3</span>
          {t(`CS 基础：${CS_NODES.length} 个科目`, `CS fundamentals: ${CS_NODES.length} subjects`)}
        </h2>
        <p className="roadmap-lead">
          {t(
            '后端、基础设施岗位和国内校招常考的计算机基础。每一行的科目建议在上一行之后学；每个科目都有选择题，操作系统和计算机网络另有图解课。',
            'The computer science basics that backend and infrastructure interviews ask about. Each row builds on the one above; every subject has multiple-choice practice, and operating systems and networking have an illustrated course.',
          )}
        </p>
        <ol className="roadmap-cs">
          {CS_LAYERS.map((layer, depth) => (
            <li key={depth}>
              <ol>
                {layer.map((node) => {
                  const course = node.course ? cs.courses[node.course] : undefined;
                  const chapters = course?.keys.map((key) => `sd:${key}`) ?? [];
                  const chapter = node.sd ? sd.find((c) => c.slug === node.sd) : undefined;
                  const total = cs.totals[node.id] ?? 0;
                  const m = csMastery(total, topicReview(review, node.id), chapters, read, recall);
                  return (
                    <li key={node.id} data-state={member ? csState(m, chapters.length) : undefined}>
                      <strong>{topicName(node.id)}</strong>
                      <span>
                        {node.after.length
                          ? t(`先修：${node.after.map(topicName).join('、')}`, `After: ${node.after.map(topicName).join(', ')}`)
                          : t('无先修', 'No prerequisites')}
                      </span>
                      {member && (
                        <span className="roadmap-cs-stats">
                          <em>{t(...CS_STATE[csState(m, chapters.length)])}</em>
                          {' · '}
                          {t(`已答 ${m.answered}/${total} · 答对 ${m.right} · 掌握 ${m.mastered}`, `Answered ${m.answered}/${total} · right ${m.right} · mastered ${m.mastered}`)}
                          {course && (
                            <>
                              <br />
                              {t(`已读 ${m.read}/${chapters.length} · 复习卡 ${m.cards}`, `Read ${m.read}/${chapters.length} · review cards ${m.cards}`)}
                            </>
                          )}
                        </span>
                      )}
                      <a href={`/oa/mcq?topic=${node.id}`}>{t(`选择题 ${total} 道`, `${total} multiple-choice questions`)}</a>
                      {course && <span>{course.title}</span>}
                      {chapter && <a href={chapter.href}>{chapter.title}</a>}
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
        <p className="roadmap-note">
          {member
            ? t('完成：选择题答过八成且八成答对，有图解课的还要读完全部章节。', 'Done: 80% of the questions answered with 80% of them right, and every chapter read where there is a course.')
            : t('登录后，每个科目会显示你的答题、阅读和复习进度。', 'Sign in to see your answers, reading and review cards on every subject.')}
        </p>
      </section>
    </div>
  );
}
