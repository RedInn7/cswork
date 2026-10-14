import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SITE_URL, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { shownMockPresets, type MockPreset } from '@/lib/server/mock-oa-presets';
import { mockPoolSizes } from '@/lib/server/mock-oa';
import { companyLogos } from '@/lib/oa-company-brands';

type Props = { params: Promise<{ company: string }> };
const LEVEL = {
  easy: ['简单', 'easy'],
  medium: ['中等', 'medium'],
  hard: ['困难', 'hard'],
} as const;

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
  const order = p.slots.map((s) => LEVEL[s][zh ? 0 : 1]).join(zh ? ' → ' : ' → ');
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
