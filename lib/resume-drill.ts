import { JD_TERMS, mentions } from './jd-keywords';
import type { Card } from './recall-cards';
import { bulletsOf, METRIC } from './resume-check';
import type { Resume } from './resume-shape';

/**
 * "How will they dig into my projects", by rules, no AI (components/resume-extend.tsx): follow-up
 * questions an interviewer asks about one resume bullet. measure quotes the bullet's number, why
 * names a technology it mentions (lib/jd-keywords.ts), mine asks for the learner's own part once per
 * entry, scale asks what breaks at 10×. Each can become a review card (`card:<id>`, lib/recall-cards.ts)
 * or a plain-text sheet a friend asks from. Pure and client-safe.
 */
export type DrillKind = 'why' | 'measure' | 'mine' | 'scale';
export type Drill = {
  id: string;
  kind: DrillKind;
  /** The bullets field, as lib/resume-check names it: 'experience.0.bullets'. */
  where: string;
  /** The entry's title (or subtitle); '' when both are empty. */
  entry: string;
  bullet: string;
  q: [string, string];
  listen: [string, string][];
};

const PER_BULLET = 2;
export const MAX_DRILLS = 24;
const TEAM = /\b(?:we|team\w*|led|collaborat\w*|partner\w*)\b|团队|合作|带领/i;
const SCALE = /\b(?:users?|requests?|qps|rps|latency|throughput|nodes?)\b|(?<![A-Za-z])[GTP]B\b|用户|请求|并发|数据量/i;
// What a measure question quotes: a figure that was measured (a change, a rate, a size), not a head
// count like "a team of 3": 40%, 3x, 420 ms, p99 latency, $2M, 10k users, 5 万, 三倍, doubled.
const UNIT =
  '%|×|x\\b|ms\\b|s\\b|secs?\\b|seconds?\\b|mins?\\b|minutes?\\b|hours?\\b|hrs?\\b|days?\\b|[kmb]\\b|[kmgtp]b\\b|' +
  '(?:users?|requests?|qps|rps|tps|queries|transactions|events|records|rows|messages|downloads|visits|views)\\b|倍|万|亿|毫秒|秒|分钟|小时|天|用户|次';
const FIGURE = new RegExp(
  `(?<![A-Za-z\\d])[$¥€£]?\\d+(?:[.,]\\d+)*\\+?\\s?(?:${UNIT})|[$¥€£]\\d+(?:[.,]\\d+)*|\\bp\\d{2,3}(?:\\s[A-Za-z]+)?|[一二两三四五六七八九十几数]+[倍万亿]|\\b(?:doubled|tripled|quadrupled|halved|half)\\b`,
  'i',
);
// Table terms that are practices or topics rather than something one picks over an alternative.
const NOT_A_CHOICE = new Set(['Debugging', 'Agile', 'Code review', 'Statistics', 'Data analysis', 'Data visualization', 'Performance optimization', 'Unit testing', 'Scalability', 'Security', 'AI', 'Front end']);
const CHOICES = JD_TERMS.filter((t) => !['dsa', 'behavioral', 'oa'].includes(t.skill ?? '') && !NOT_A_CHOICE.has(t.term));

const LISTEN: Record<DrillKind, [string, string][]> = {
  measure: [
    ['基线：改之前是多少，在什么条件下测的', 'The baseline: the number before the change, and the conditions it was taken under'],
    ['测量方法：压测、线上日志和监控，还是 A/B 实验', 'How it was measured: a load test, production logs and dashboards, or an A/B test'],
    ['样本量和噪声：测了多久、多少请求，怎么排除缓存预热和流量波动', 'Sample size and noise: how long, how many requests, and how warm-up or traffic swings were ruled out'],
  ],
  why: [
    ['当时的约束：数据量、延迟要求、团队熟悉什么、工期', 'The constraints behind it: data size, latency target, what the team knew, the deadline'],
    ['考虑过但否掉的方案，以及否掉的理由', 'The alternatives that were turned down, and why'],
    ['这个选择的代价：放弃了什么，什么情况下会换掉它', 'What the choice cost, and when you would switch away from it'],
  ],
  mine: [
    ['只讲自己动手的部分，说“我”而不是“我们”', 'Only what you did yourself: “I”, not “we”'],
    ['自己做的一个决定，和自己解决的一个难点', 'One decision you made and one hard part you solved'],
    ['和别人怎么分工、怎么对齐', 'How the work was split and how you stayed in sync with the others'],
  ],
  scale: [
    ['第一个瓶颈：数据库、单机内存、网络，还是外部依赖', 'The first bottleneck: the database, one machine’s memory, the network or a dependency'],
    ['怎么提前发现：哪个指标会先报警', 'How you would see it coming: which metric alarms first'],
    ['怎么扩：缓存、分片、异步队列、加机器，各自的代价', 'How to scale it (cache, shard, queue, more machines) and what each one costs'],
  ],
};

/** FNV-1a over UTF-16 units, 32 bits. */
function fnv(text: string, seed = 0x811c9dc5) {
  let h = seed;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
/** 12 a-z0-9 from the kind and the bullet: the same question is the same card, so adding it again overwrites. */
export function drillId(kind: DrillKind, bullet: string) {
  const a = fnv(`${kind}\n${bullet}`);
  const b = fnv(`${kind}\n${bullet}`, a ^ 0x9e3779b9);
  return (a.toString(36).padStart(7, '0') + b.toString(36).padStart(7, '0')).slice(0, 12);
}

/** The follow-up questions for every bullet of experience and projects: up to 2 per bullet, MAX_DRILLS in all. */
export function resumeDrills(r: Resume): Drill[] {
  const out: Drill[] = [];
  const seen = new Set<string>();
  for (const key of ['experience', 'projects'] as const)
    r[key].forEach((item, index) => {
      const bullets = bulletsOf(item.bullets);
      const where = `${key}.${index}.bullets`;
      const entry = item.title.trim() || item.subtitle.trim();
      // One "your part" per entry: the first teamwork bullet; a job without one asks about its first bullet.
      const mine = bullets.findIndex((b) => TEAM.test(b));
      const mineAt = mine >= 0 ? mine : key === 'experience' ? 0 : -1;
      const asked = new Set<string>();
      bullets.forEach((bullet, i) => {
        const add = (kind: DrillKind, q: [string, string]) => {
          const id = drillId(kind, bullet);
          if (seen.has(id)) return;
          seen.add(id);
          out.push({ id, kind, where, entry, bullet, q, listen: LISTEN[kind] });
        };
        const picks: [DrillKind, [string, string]][] = [];
        if (i === mineAt) picks.push(['mine', ['这件事里，你个人具体做了哪部分？', 'Which part of this did you do yourself?']]);
        const figure = METRIC.test(bullet) ? FIGURE.exec(bullet)?.[0].trim() : undefined;
        if (figure) picks.push(['measure', [`「${figure}」是怎么测出来的？基线是多少？`, `How did you measure “${figure}”? What was the baseline?`]]);
        const term = CHOICES.find((t) => !asked.has(t.term) && mentions(t.term, bullet)) ?? CHOICES.find((t) => !asked.has(t.term) && mentions(t.term, item.subtitle));
        if (term) picks.push(['why', [`为什么选 ${term.term}？当时还考虑过什么？`, `Why ${term.term}? What else did you consider?`]]);
        if (SCALE.test(bullet) || JD_TERMS.some((t) => (t.skill === 'system-design' || t.skill === 'sql') && mentions(t.term, bullet)))
          picks.push(['scale', ['如果规模扩大 10 倍，哪里会先撑不住？', 'If the load grew 10×, what would break first?']]);
        for (const [kind, q] of picks.slice(0, PER_BULLET)) {
          if (kind === 'why') asked.add(term!.term);
          add(kind, q);
        }
      });
    });
  return out.slice(0, MAX_DRILLS);
}

/** The entry's name, or its section and number when it has none. */
export function drillEntry(d: Drill, zh: boolean) {
  if (d.entry) return d.entry;
  const [key, index] = d.where.split('.');
  const n = Number(index) + 1;
  return key === 'experience' ? (zh ? `工作经历 ${n}` : `Experience ${n}`) : zh ? `项目 ${n}` : `Project ${n}`;
}

const listenText = (d: Drill, zh: boolean) => d.listen.map(([a, b]) => `- ${zh ? a : b}`).join('\n');

/** The question as a review card: the entry and question on the front, the bullet and what to cover on the back. */
export function drillCard(d: Drill, zh: boolean): Card {
  const entry = drillEntry(d, zh);
  const bullet = d.bullet.length > 300 ? `${d.bullet.slice(0, 299)}…` : d.bullet;
  return {
    v: 1,
    front: `${entry}${zh ? '：' : ': '}${zh ? d.q[0] : d.q[1]}`,
    back: `${bullet}\n\n${zh ? '要讲到：' : 'Cover:'}\n${listenText(d, zh)}`,
    tags: ['resume', `resume-${d.kind}`],
    src: { href: `/career/resume/builder#resume-${d.where.replace(/\./g, '-')}`, title: `${zh ? '简历' : 'Resume'} · ${entry}`.slice(0, 200) },
  };
}

/** Plain text for a friend to ask from, grouped by entry: each bullet, then each question and what to listen for. No name or contact lines. */
export function drillSheet(ds: readonly Drill[], zh: boolean) {
  const out = [
    zh ? `简历追问 · ${ds.length} 题` : `Resume follow-ups · ${ds.length} ${ds.length === 1 ? 'question' : 'questions'}`,
    zh ? '照着顺序问，对照“听什么”看对方有没有答到。' : 'Ask them in order; check the answer against “Listen for”.',
  ];
  let where = '';
  let bullet = '';
  ds.forEach((d, i) => {
    if (d.where !== where) out.push('', zh ? `【${drillEntry(d, zh)}】` : `[${drillEntry(d, zh)}]`);
    if (d.where !== where || d.bullet !== bullet) out.push(`${zh ? '要点：' : 'Bullet: '}${d.bullet}`);
    [where, bullet] = [d.where, d.bullet];
    out.push(`${i + 1}. ${zh ? '问：' : 'Ask: '}${zh ? d.q[0] : d.q[1]}`, `   ${zh ? '听什么：' : 'Listen for:'}`, ...listenText(d, zh).split('\n').map((l) => `   ${l}`));
  });
  return out.join('\n') + '\n';
}
