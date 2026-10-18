// The parts of a /topics/<stop> page built from lib/server/topic-page.ts and lib/content/topic-why.json:
// header facts, the warm-up, why the template is correct, and the practice tables. No hooks.
import '@/app/redesign.css';
import whyFile from '@/lib/content/topic-why.json';
import { levelOf } from '@/lib/classic-lists';
import { companyHubPath, oaCompanyName } from '@/lib/oa-company-brands';
import { askedText, STOP_NAMES } from '@/lib/route-stops';
import { topicPath, type Bilingual } from '@/lib/route-templates';
import type { Status, StopCount, TopicPractice } from '@/lib/server/topic-page';
import { RatingBadge } from '@/components/rating-badge';
import { RecallRate } from '@/components/recall-rate';
import { TopicSay } from '@/components/topic-say';
import type { TopicStop } from './stops';

type Why = { why: Bilingual[]; say: Bilingual; core: string[] };
const WHY = whyFile as Record<string, Why>;
/** A stop's correctness points and spoken script (every stop has one: tests/topic-why.test.ts). */
export const topicWhy = (slug: string): Why | undefined => (Object.hasOwn(WHY, slug) ? WHY[slug] : undefined);

const STATUS: Record<Status, [string, string]> = {
  solved: ['已通过', 'Solved'],
  attempted: ['尝试过', 'Attempted'],
  not_started: ['未开始', 'Not started'],
};
const level = (difficulty: string, zh: boolean) => levelOf(difficulty)?.[zh ? 1 : 2] ?? difficulty;
// route-graph's rule: a prerequisite is met once 60% of it is solved.
const met = (s: StopCount) => s.solved !== undefined && s.total > 0 && s.solved / s.total >= 0.6;

function StopChips({ stops, zh }: { stops: StopCount[]; zh: boolean }) {
  return (
    <ul className="topics-chips">
      {stops.map((s) => (
        <li key={s.slug}>
          <a href={topicPath(s.slug)} data-met={met(s) || undefined}>
            {STOP_NAMES[s.slug]?.[zh ? 0 : 1] ?? s.slug}
            {s.solved !== undefined && (
              <span className="topics-chip-count">
                <span className="sr-only">{zh ? '，已通过 ' : ', solved '}</span>
                {s.solved}/{s.total}
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Under the station sign: what to learn first, where it leads, how often it is asked and your progress. */
export function TopicHeader({ practice, zh }: { practice: TopicPractice; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const { asked } = practice;
  return (
    <section className="topics-header" aria-label={t('本站概览', 'Stop overview')}>
      <dl>
        <div>
          <dt>{t('先学', 'Learn first')}</dt>
          <dd>
            {practice.prereqs.length ? (
              <StopChips stops={practice.prereqs} zh={zh} />
            ) : (
              t('起点站，不需要先修。', 'A starting stop: nothing to learn first.')
            )}
          </dd>
        </div>
        <div>
          <dt>{t('学完去', 'Leads to')}</dt>
          <dd>
            {practice.leadsTo.length ? (
              <StopChips stops={practice.leadsTo} zh={zh} />
            ) : (
              t('没有后续站依赖它。', 'No later stop builds on it.')
            )}
          </dd>
        </div>
        <div>
          <dt>{t('面试频次', 'How often asked')}</dt>
          <dd>
            {askedText(asked, zh) || t('面经里还没有对应到这一站的题。', 'No interview reports map onto this stop yet.')}
            {asked.top.length > 0 && (
              <span className="topics-asked-top">
                {asked.top.map((c, i) => (
                  <span key={c.slug}>
                    {i > 0 && t('、', ', ')}
                    {c.hub ? <a href={companyHubPath(c.slug)}>{c.name}</a> : c.name} <small>{c.count}</small>
                  </span>
                ))}
              </span>
            )}
          </dd>
        </div>
        {practice.signedIn && (
          <div>
            <dt>{t('我的进度', 'My progress')}</dt>
            <dd className="topics-progress">
              {practice.stages
                .filter((s) => s.rows.length)
                .map((s) => (
                  <span key={s.stage}>
                    {zh ? s.stage : s.stageEn}{' '}
                    <strong>
                      {s.rows.filter((r) => r.status === 'solved').length}/{s.rows.length}
                    </strong>
                  </span>
                ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/** "Do this one first": the stop's warm-up, its approach folded away. */
export function TopicFocus({ practice, zh }: { practice: TopicPractice; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const focus = practice.focus;
  if (!focus) return null;
  const approach = zh ? focus.reason : focus.reasonEn;
  return (
    <section className="topics-template topics-focus" aria-labelledby="topic-focus">
      <h2 id="topic-focus">{t('先做这道', 'Warm up with this one')}</h2>
      <a className="topics-focus-card" href={focus.href}>
        <span className="topics-focus-no">LC {focus.number}</span>
        <strong>{zh ? focus.titleZh : focus.titleEn}</strong>
        <span className="topics-focus-meta">
          {level(focus.difficulty, zh)}
          {focus.status === 'solved' && ` · ${t('已通过', 'Solved')}`}
        </span>
      </a>
      {approach && (
        <details className="topics-focus-hint">
          <summary>{t('卡住再看', 'Stuck? Peek at the approach')}</summary>
          <p>{approach}</p>
        </details>
      )}
    </section>
  );
}

/** Why the template is correct, the 30-second script in both languages, and a self-graded recall card. */
export function TopicWhy({ stop, zh, signedIn }: { stop: TopicStop; zh: boolean; signedIn: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const why = topicWhy(stop.slug);
  if (!why) return null;
  const points = why.why.map((p) => (zh ? p.zh : p.en));
  const target = `content:topic/${stop.slug}`;
  return (
    <section className="topics-template topics-why" aria-labelledby="topic-why">
      <h2 id="topic-why">{t('为什么对', 'Why it works')}</h2>
      <ol className="topics-why-points">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ol>
      <h3>{t('30 秒口述稿', 'Say it in 30 seconds')}</h3>
      <p className="topics-template-lead">
        {t(
          '面试官让你讲思路时，按做法、为什么对、复杂度的顺序说。中英文各一版，可以对着读几遍。',
          'When the interviewer asks you to talk it through: the approach, why it is correct, then the cost. One version in each language to read aloud a few times.',
        )}
      </p>
      <div className="topics-say">
        <figure>
          <figcaption>
            中文 <TopicSay text={why.say.zh} lang="zh" label={t('朗读中文稿', 'Listen to the Chinese script')} />
          </figcaption>
          <blockquote lang="zh-CN">{why.say.zh}</blockquote>
        </figure>
        <figure>
          <figcaption>
            English <TopicSay text={why.say.en} lang="en" label={t('朗读英文稿', 'Listen to the English script')} />
          </figcaption>
          <blockquote lang="en">{why.say.en}</blockquote>
        </figure>
      </div>
      <div className="rd">
        <RecallRate
          key={target}
          target={target}
          title={`${zh ? stop.title : stop.titleEn} · ${t('为什么对', 'why it works')}`}
          points={points}
          signedIn={signedIn}
        />
      </div>
    </section>
  );
}

function StatusCell({ status, zh }: { status?: Status; zh: boolean }) {
  return <td data-status={status}>{status ? STATUS[status][zh ? 0 : 1] : ''}</td>;
}

/** The stop's Line 500 problems in three tables, its OA questions and its Core Skills. */
export function TopicPracticeTables({ stop, practice, zh }: { stop: TopicStop; practice: TopicPractice; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const { signedIn, oa, core } = practice;
  return (
    <section className="topics-template topics-practice" aria-labelledby="topic-practice">
      <h2 id="topic-practice">{t('分档练习', 'Practice by stage')}</h2>
      <p className="topics-template-lead">
        {t(
          `本站在 500 路里的 ${stop.problems} 道题，按基础、核心、进阶分三档。每题附一句话思路，先自己想，想不出再看。`,
          `This stop's ${stop.problems} Line 500 problems in three stages: Foundation, Core and Advanced. Each has a one-line approach; try it yourself before reading it.`,
        )}
      </p>
      {practice.stages
        .filter((s) => s.rows.length)
        .map((s, i) => (
          <div className="topics-stage" key={s.stage}>
            <h3 id={`topic-stage-${i}`}>
              {zh ? s.stage : s.stageEn} <small>{s.rows.length}</small>
            </h3>
            <div className="topics-table-scroll" role="region" aria-labelledby={`topic-stage-${i}`} tabIndex={0}>
              <table className="topics-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">{t('题目', 'Problem')}</th>
                    <th scope="col">{t('一句话思路', 'Approach')}</th>
                    <th scope="col">{t('难度分', 'Rating')}</th>
                    {signedIn && <th scope="col">{t('状态', 'Status')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.number}</td>
                      <td>
                        <a href={row.href}>{zh ? row.titleZh : row.titleEn}</a>
                      </td>
                      <td>{(zh ? row.reason : row.reasonEn) || t('比赛或考试结束后显示', 'Shown after your contest or exam')}</td>
                      <td>
                        <RatingBadge rating={row.rating} english={!zh} />
                      </td>
                      {signedIn && <StatusCell status={row.status} zh={zh} />}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      {oa.total > 0 && (
        <div className="topics-stage topics-oa">
          <h3>
            {t('本站 OA 真题', 'OA questions on this topic')} <small>{oa.total}</small>
          </h3>
          <ul className="topics-links">
            {oa.items.map((item) => (
              <li key={item.id}>
                <a href={item.href}>{item.title}</a>
                <span>{oaCompanyName(item.companySlug, item.companyName, zh ? 'zh' : 'en')}</span>
                {item.status && item.status !== 'not_started' && <span data-status={item.status}>{STATUS[item.status][zh ? 0 : 1]}</span>}
              </li>
            ))}
          </ul>
          <a className="topics-more" href={`/?view=problems&library=oa&topic=${encodeURIComponent(stop.slug)}`}>
            {t(`全部 ${oa.total} 道`, `All ${oa.total}`)} <span aria-hidden="true">→</span>
          </a>
        </div>
      )}
      {core.length > 0 && (
        <div className="topics-stage topics-core">
          <h3>Core Skills</h3>
          <p className="topics-template-lead">
            {t('不调库，亲手实现这一站用到的数据结构或算法，四种语言都能判题。', "Build this stop's data structure or algorithm by hand, without libraries, judged in four languages.")}
          </p>
          <ul className="topics-links">
            {core.map((item) => (
              <li key={item.id}>
                <a href={item.href}>{zh ? item.titleZh : item.titleEn}</a>
                <span>{level(item.difficulty, zh)}</span>
                {item.status && item.status !== 'not_started' && <span data-status={item.status}>{STATUS[item.status][zh ? 0 : 1]}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
