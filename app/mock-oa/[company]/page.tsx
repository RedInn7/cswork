import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SITE_URL, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { shownMockPresets, type MockPreset } from '@/lib/server/mock-oa-presets';
import { mockPoolSizes } from '@/lib/server/mock-oa';
import { companyLogos } from '@/lib/oa-company-brands';
import { SLOTS } from '@/lib/mock-oa';
import { stopHref, topicName } from '@/lib/route-stops';
import { oaTopicProfile } from '@/lib/server/oa-topics';

type Props = { params: Promise<{ company: string }> };
const LEVEL = {
  easy: ['简单', 'easy'],
  medium: ['中等', 'medium'],
  hard: ['困难', 'hard'],
} as const;

/** Fewer OA problems than this are too few to measure; the preset's reported topics stand in. */
const MEASURABLE = 5;

/** Hidden or unknown companies are a real 404. */
async function load(params: Props['params']) {
  const { company } = await params;
  const preset = /^[a-z0-9-]{1,80}$/.test(company)
    ? shownMockPresets().find((p) => p.slug === company)
    : undefined;
  if (!preset) notFound();
  return preset;
}

function text(p: MockPreset, zh: boolean) {
  const title = zh
    ? `${p.name} OA 模拟：${p.minutes} 分钟 ${p.questions} 题（${p.platform}）· CSWork`
    : `${p.name} OA mock: ${p.questions} questions in ${p.minutes} minutes (${p.platform}) · CSWork`;
  const lead = zh
    ? `在 CSWork 限时模拟 ${p.name} OA：${p.minutes} 分钟 ${p.questions} 道编程题，按 ${p.platform} 的方式在线判题，时间到自动交卷并评分。`
    : `Take a timed ${p.name} OA mock on CSWork: ${p.questions} coding questions in ${p.minutes} minutes, judged online ${p.platform}-style, auto-submitted at time-up and scored.`;
  const description = lead.length > 170 ? lead.slice(0, 167) + '…' : lead;
  return { title, lead, description };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const preset = await load(params);
  const { title, description } = text(preset, (await requestLocale()) === 'zh');
  return seoMetadata({ title, description, path: `/mock-oa/${preset.slug}` });
}

export default async function MockOaCompany({ params }: Props) {
  const p = await load(params);
  const zh = (await requestLocale()) === 'zh';
  const { title, lead, description } = text(p, zh);
  const pool = (await mockPoolSizes())?.get(p.slug);
  // "None" / "None (remark)" means coding only; anything else is a section the mock leaves out.
  const sections = zh ? p.sections_zh : p.sections_en;
  const extra = /^(?:None\b|无)/.test(sections) ? '' : sections;
  const order = p.slots.map((s) => LEVEL[s][zh ? 0 : 1]).join(' → ');
  const url = `${SITE_URL}/mock-oa/${p.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Mock OA', item: `${SITE_URL}/mock-oa` },
        { '@type': 'ListItem', position: 2, name: p.name, item: url },
      ],
    },
  };
  const logo = Object.hasOwn(companyLogos, p.slug) ? companyLogos[p.slug] : null;
  const profile = oaTopicProfile(p.aliases);
  const measured = profile.count >= MEASURABLE;
  // Measured: share of the topic labels (top 8). Otherwise: the reported topics' relative weight.
  const bars = measured
    ? profile.topics.slice(0, 8).map((t) => ({ slug: t.slug, value: t.share }))
    : p.topics.map((t) => ({ slug: t.slug, value: t.weight }));
  const top = Math.max(...bars.map((b) => b.value), 0) || 1;
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const chartCaption = measured
    ? zh
      ? `基于本站 ${profile.count} 道 ${p.name} OA 真题的专题标注（AI 辅助估计）`
      : `From topic labels on ${profile.count} ${p.name} OA problems on this site (AI-assisted estimates)`
    : zh
      ? `${profile.count ? `本站只有 ${profile.count} 道 ${p.name} OA 真题，样本太少` : `本站还没有 ${p.name} OA 真题`}；下面是候选人面经里反复提到的考点（相对权重）`
      : `${profile.count ? `Only ${profile.count} ${p.name} OA ${profile.count === 1 ? 'problem' : 'problems'} on this site, too few to measure` : `No ${p.name} OA problems on this site yet`}; these are the topics candidate reports keep mentioning (relative weight)`;
  const facts: [string, string][] = [
    [zh ? '平台' : 'Platform', p.platform],
    [zh ? '题量' : 'Questions', String(p.questions)],
    [zh ? '时长' : 'Time limit', zh ? `${p.minutes} 分钟` : `${p.minutes} minutes`],
    [zh ? '难度顺序' : 'Difficulty order', order],
    [
      zh ? '计分' : 'Scoring',
      p.scoring === 'gca'
        ? zh
          ? 'CodeSignal GCA 风格估算（200–600）'
          : 'CodeSignal GCA-style estimate (200–600)'
        : zh
          ? '每题按通过的测试用例 0–100 分'
          : 'Each question 0–100 by tests passed',
    ],
    [zh ? '适用' : 'Roles', p.roles.join(zh ? '、' : ', ')],
    [zh ? '编程之外' : 'Besides coding', sections],
  ];
  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <nav className="mock-public-crumbs" aria-label="Breadcrumb">
        <Link href="/mock-oa" prefetch={false}>
          Mock OA
        </Link>
        <span aria-hidden="true">/</span>
        <span>{p.name}</span>
      </nav>
      <section className="mock-public-hero">
        <p className="mock-public-kicker">
          {logo && (
            // oxlint-disable-next-line nextjs/no-img-element -- Small local SVG logo.
            <img src={logo} alt="" width={20} height={20} />
          )}
          {p.name} · {p.platform}
        </p>
        <h1>
          {zh
            ? `${p.name} OA 模拟：${p.minutes} 分钟 ${p.questions} 题`
            : `${p.name} OA mock: ${p.questions} questions in ${p.minutes} minutes`}
        </h1>
        <p>{lead}</p>
        <div className="mock-public-actions">
          <a className="mock-public-cta" href={`/?view=mock&company=${p.slug}`}>
            {zh ? `开始 ${p.name} 模拟` : `Start the ${p.name} mock`} →
          </a>
          {pool !== undefined && (
            <span>
              {zh
                ? `题池 ${pool} 道可判题（OA 真题 + 高频 LeetCode）`
                : `${pool} judgeable problems in the pool (OA bank + frequent LeetCode)`}
            </span>
          )}
        </div>
      </section>
      <section aria-labelledby="mock-public-format">
        <h2 id="mock-public-format" className="mock-public-h2">
          {zh ? `${p.name} OA 的真实格式` : `The real ${p.name} OA format`}
        </h2>
        <dl className="mock-public-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mock-public-notes">{zh ? p.notes_zh : p.notes_en}</p>
      </section>
      <section className="mock-public-tests" aria-labelledby="mock-public-tests">
        <h2 id="mock-public-tests" className="mock-public-h2">
          {zh ? `${p.name} OA 考察内容` : `What the ${p.name} OA tests`}
        </h2>
        <p className="mock-public-focus">{zh ? p.focus_zh : p.focus_en}</p>
        <div className="mock-public-tests-grid">
          <figure className="mock-public-chart">
            <figcaption>{chartCaption}</figcaption>
            <ol className="mock-public-bars">
              {bars.map(({ slug, value }) => {
                const href = stopHref(slug),
                  name = topicName(slug, zh);
                return (
                  <li key={slug} style={{ '--w': value / top } as React.CSSProperties}>
                    <span className="mock-public-bar-name">
                      {href ? <a href={href}>{name}</a> : name}
                    </span>
                    <span className="mock-public-bar" aria-hidden="true" />
                    <span className="mock-public-bar-value">
                      {measured ? percent(value) : value.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ol>
            {bars.some((b) => stopHref(b.slug)) && (
              <p className="mock-public-hint">
                {zh
                  ? '点专题名，去 500 路对应的站点专项练习。'
                  : 'Pick a topic to practise its stop on Line 500.'}
              </p>
            )}
            {measured && (
              <div className="mock-public-mix">
                <p>{zh ? '估计难度分布' : 'Estimated difficulty mix'}</p>
                <div className="mock-public-mix-bar" aria-hidden="true">
                  {SLOTS.filter((s) => profile.difficulty[s]).map((s) => (
                    <i key={s} data-level={s} style={{ flexGrow: profile.difficulty[s] }} />
                  ))}
                </div>
                <ul>
                  {SLOTS.map((s) => (
                    <li key={s} data-level={s}>
                      {LEVEL[s][zh ? 0 : 1]} {percent(profile.difficulty[s] / profile.count)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </figure>
          <dl className="mock-public-advice">
            <div>
              <dt>{zh ? '题面风格' : 'Style'}</dt>
              <dd>{zh ? p.style_zh : p.style_en}</dd>
            </div>
            <div>
              <dt>{zh ? '备考建议' : 'How to prepare'}</dt>
              <dd>{zh ? p.tips_zh : p.tips_en}</dd>
            </div>
          </dl>
        </div>
        {p.evidence === 'thin' && (
          <p className="mock-public-caveat">
            {zh
              ? '这家公司公开的 OA 信息很少，以上内容只作参考。'
              : 'There is little public information about this OA, so treat this as a rough guide.'}
          </p>
        )}
      </section>
      <section className="mock-public-split" aria-label={zh ? '模拟范围' : 'What the mock covers'}>
        <div>
          <h2 className="mock-public-h2">{zh ? '本模拟包含' : 'What this mock simulates'}</h2>
          <ul>
            <li>
              {zh
                ? `${p.questions} 道编程题，难度顺序 ${order}`
                : `${p.questions} coding questions, in the order ${order}`}
            </li>
            <li>
              {zh
                ? `${p.minutes} 分钟倒计时，离开页面也不暂停，时间到自动交卷`
                : `A ${p.minutes}-minute countdown that keeps running if you leave, and submits itself at zero`}
            </li>
            <li>
              {zh
                ? `题目从 ${p.name} 的 OA 真题和高频 LeetCode 题里抽，优先没做过的`
                : `Problems drawn from ${p.name}'s OA bank and its frequent LeetCode questions, preferring ones you have not solved`}
            </li>
            <li>
              {zh
                ? '考试期间隐藏题解和提示，交卷后给出成绩单并解锁题解'
                : 'Solutions and hints stay hidden until you finish; then a score report and the solutions'}
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mock-public-h2">{zh ? '不在模拟内' : 'Not simulated'}</h2>
          <ul>
            {extra && <li>{extra}</li>}
            <li>
              {zh
                ? '摄像头、麦克风、屏幕监考和查重'
                : 'Camera, microphone or screen proctoring, and plagiarism checks'}
            </li>
            <li>
              {zh
                ? `${p.platform} 自己的编辑器界面；这里用 CSWork 的在线编辑器和判题`
                : `${p.platform}'s own editor; you use the CSWork editor and judge`}
            </li>
          </ul>
        </div>
      </section>
      <section aria-labelledby="mock-public-sources">
        <h2 id="mock-public-sources" className="mock-public-h2">
          {zh ? '格式来源' : 'Where the format comes from'}
        </h2>
        <ul className="mock-public-sources">
          {p.refs.map((r) => (
            <li key={r.url}>
              <a href={r.url} rel="nofollow noopener noreferrer" target="_blank">
                {r.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <nav className="mock-public-others" aria-label={zh ? '其他公司' : 'Other companies'}>
        <h2 className="mock-public-h2">{zh ? '其他公司' : 'Other companies'}</h2>
        <ul>
          {shownMockPresets()
            .filter((o) => o.slug !== p.slug)
            .map((o) => (
              <li key={o.slug}>
                <Link href={`/mock-oa/${o.slug}`} prefetch={false}>
                  {o.name}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </article>
  );
}
