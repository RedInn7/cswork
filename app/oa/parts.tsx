import { extraSections } from '@/lib/mock-oa';
import { companyHue, companyInitials, companyLogos } from '@/lib/oa-company-brands';
import { OA_KIND_NAMES, topicName } from '@/lib/route-stops';
import type { MockPreset } from '@/lib/server/mock-oa-presets';

/** Server twin of CompanyIdentity's mark: reviewed local logo, else hued initials. */
export function OaCompanyMark({ slug, name }: { slug: string; name: string }) {
  const asset = Object.hasOwn(companyLogos, slug) ? companyLogos[slug] : '';
  return (
    <span className="oa-company-logo" aria-hidden="true">
      {asset ? (
        // oxlint-disable-next-line nextjs/no-img-element -- Small reviewed SVGs served from public/.
        <img src={asset} alt="" width={20} height={20} decoding="async" />
      ) : (
        <span
          className="oa-company-initials"
          style={{ '--oa-hue': companyHue(slug) } as React.CSSProperties}
        >
          {companyInitials(name)}
        </span>
      )}
    </span>
  );
}

const difficulties: Record<string, [level: string, en: string]> = {
  简单: ['easy', 'Easy'],
  中等: ['medium', 'Medium'],
  困难: ['hard', 'Hard'],
};
/** Difficulty (zh) as a chip, ≈ when it is the AI estimate; nothing when unknown. */
export function OaDifficulty({
  difficulty,
  difficultyEstimated,
  locale,
}: {
  difficulty?: string;
  difficultyEstimated?: boolean;
  locale: 'zh' | 'en';
}) {
  const known =
    difficulty && Object.hasOwn(difficulties, difficulty) ? difficulties[difficulty] : null;
  if (!known) return null;
  const zh = locale === 'zh';
  return (
    <span
      className="oa-public-chip"
      data-level={known[0]}
      title={difficultyEstimated ? (zh ? 'AI 估计的难度' : 'AI-estimated difficulty') : undefined}
    >
      {difficultyEstimated && <span aria-hidden="true">≈</span>}
      {difficultyEstimated && <span className="sr-only">{zh ? '估计' : 'Estimated '}</span>}
      {zh ? difficulty : known[1]}
    </span>
  );
}

/** A problem's AI-estimated topics as plain names, with the concept-question label first. */
export function oaTopicLine(item: { topics: string[]; kind?: string }, zh: boolean) {
  return [
    ...(item.kind && Object.hasOwn(OA_KIND_NAMES, item.kind)
      ? [OA_KIND_NAMES[item.kind][zh ? 0 : 1]]
      : []),
    ...item.topics.map((slug) => topicName(slug, zh)),
  ].join(' · ');
}

/** A company row's OA format tag: "CodeSignal · 4 题 · 70 分钟". */
export const oaExamTag = (p: Pick<MockPreset, 'platform' | 'questions' | 'minutes'>, zh: boolean) =>
  zh
    ? `${p.platform} · ${p.questions} 题 · ${p.minutes} 分钟`
    : `${p.platform} · ${p.questions} Q · ${p.minutes} min`;

/** The real OA's format, as researched for the mock presets (lib/content/mock-oa-presets.json). */
export function OaExamFormat({ preset: p, updated, zh }: { preset: MockPreset; updated: string; zh: boolean }) {
  const extra = extraSections(p, zh);
  const rows: [string, React.ReactNode][] = [
    [zh ? '平台' : 'Platform', p.platform],
    [zh ? '题量' : 'Questions', zh ? `${p.questions} 道编程题` : `${p.questions} coding`],
    [zh ? '时长' : 'Time', zh ? `${p.minutes} 分钟` : `${p.minutes} min`],
    [
      zh ? '计分' : 'Scoring',
      p.scoring === 'gca'
        ? zh
          ? 'CodeSignal GCA 式 200–600 分'
          : 'CodeSignal GCA-style, 200–600'
        : zh
          ? '按通过的测试点计分'
          : 'By test cases passed',
    ],
    [
      zh ? '编程以外的环节' : 'Besides coding',
      extra.codingOnly
        ? (zh ? '无' : 'None') + (extra.text ? (zh ? `（${extra.text}）` : ` (${extra.text})`) : '')
        : extra.text,
    ],
    [zh ? '适用岗位' : 'Roles', p.roles.join(zh ? '、' : ', ')],
    [zh ? '说明' : 'Notes', zh ? p.notes_zh : p.notes_en],
    [
      zh ? '来源' : 'Sources',
      p.refs.length ? (
        <ul key="refs">
          {p.refs.map((r) => (
            <li key={r.url}>
              <a href={r.url} rel="nofollow noopener noreferrer" target="_blank">
                {r.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null,
    ],
  ];
  return (
    <section className="oa-exam" aria-labelledby="oa-exam-title">
      <h2 id="oa-exam-title" className="oa-public-section">
        {zh ? '考试形式' : 'Exam format'}
      </h2>
      <dl className="oa-exam-format">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      <p className="oa-exam-updated">{zh ? `资料更新于 ${updated}` : `Last researched ${updated}`}</p>
    </section>
  );
}
