import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { shownMockPresets } from '@/lib/server/mock-oa-presets';
import { mockPoolSizes } from '@/lib/server/mock-oa';
import { companyLogos } from '@/lib/oa-company-brands';

const copy = {
  en: {
    title: 'Timed mock OA for Amazon, TikTok, Meta and more · CSWork',
    description:
      "Practice online assessments in each company's real format: the same platform style, question count and time limit, auto-submitted at time-up and scored. Free with a verified account.",
    h1: 'Timed mock OAs in each company’s real format.',
    cta: 'Start a mock',
  },
  zh: {
    title: '限时模拟 OA：Amazon、TikTok、Meta 等公司真实格式 · CSWork',
    description:
      '按各公司真实的 OA 格式练习：相同的平台风格、题量和时长，时间到自动交卷并给出成绩单。验证邮箱后免费使用。',
    h1: '按各公司真实格式，限时模拟 OA。',
    cta: '开始模拟',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/mock-oa' });
}

export default async function MockOaIndex() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const presets = shownMockPresets(),
    pools = await mockPoolSizes();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: c.title,
    description: c.description,
    url: `${SITE_URL}/mock-oa`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: presets.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${p.name} OA mock`,
        url: `${SITE_URL}/mock-oa/${p.slug}`,
      })),
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <section className="mock-public-hero">
        <p className="mock-public-kicker">MOCK OA · {zh ? '限时模拟' : 'TIMED'}</p>
        <h1>{c.h1}</h1>
        <p>
          {zh
            ? `${presets.length} 家公司的 OA 格式来自近期候选人报告和官方说明：平台、题量、时长和难度顺序都照着来。题目从这家公司的 OA 真题和高频 LeetCode 题里抽，在线判题，时间到自动交卷，交卷后给出成绩单并解锁题解。`
            : `Formats for ${presets.length} companies, taken from recent candidate reports and official guides: platform, question count, time limit and difficulty order. Problems come from each company's OA bank and its frequent LeetCode questions and are judged online; at time-up the mock submits itself, then you get a score report and the solutions.`}
        </p>
        <a className="mock-public-cta" href="/?view=mock">
          {c.cta} →
        </a>
      </section>
      <section aria-labelledby="mock-public-board">
        <h2 id="mock-public-board" className="mock-public-h2">
          {zh ? '各公司 OA 格式' : 'OA formats by company'}
        </h2>
        <ul className="mock-public-board">
          {presets.map((p) => {
            const logo = Object.hasOwn(companyLogos, p.slug) ? companyLogos[p.slug] : null;
            const pool = pools?.get(p.slug);
            return (
              <li key={p.slug}>
                <Link href={`/mock-oa/${p.slug}`} prefetch={false}>
                  <span className="mock-public-logo" aria-hidden="true">
                    {/* oxlint-disable-next-line nextjs/no-img-element -- Small local SVG logos. */}
                    {logo ? <img src={logo} alt="" width={20} height={20} loading="lazy" /> : p.name.slice(0, 2)}
                  </span>
                  <strong>{p.name}</strong>
                  <span className="mock-public-platform">{p.platform}</span>
                  <span className="mock-public-format">
                    {zh ? `${p.questions} 题 · ${p.minutes} 分钟` : `${p.questions} questions · ${p.minutes} min`}
                  </span>
                  {pool !== undefined && (
                    <span className="mock-public-pool">
                      {zh ? `题池 ${pool}` : `${pool} in pool`}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
