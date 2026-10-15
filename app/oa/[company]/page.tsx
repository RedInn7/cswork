import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  OTHER_COMPANY,
  companyHubPath,
  oaCompanyName,
  oaCompanyPath,
  oaProblemPath,
} from '@/lib/oa-company-brands';
import { breadcrumbJsonLd, oaPageTitle, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { oaReadyProblems } from '@/lib/server/oa-judge';
import { oaLibrary } from '@/lib/server/oa-library';
import { MOCK_PRESETS_UPDATED, mockPresetFor } from '@/lib/server/mock-oa-presets';
import { oaDifficulty } from '@/lib/server/oa-topics';
import { OaCompanyMark, OaDifficulty, OaExamFormat, oaTopicLine } from '../parts';

type Props = { params: Promise<{ company: string }> };
const load = cache(async (slug: string) => {
  const ready = await oaReadyProblems();
  // Hidden companies and merged alias slugs are not pages; only canonical links exist.
  const data = oaLibrary().company(slug, new Set(ready.keys()));
  if (!data) notFound();
  const locale = await requestLocale();
  const name = oaCompanyName(data.company.slug, data.company.name, locale);
  const { count, ready: judged } = data.company;
  const lead =
    locale === 'zh'
      ? `${name} 的 ${count} 道 OA 真题，${judged} 道可以在线运行样例并提交评测。阅读题面，然后在 CSWork 练习工作台中用 Python、Java、C++ 或 Go 作答。`
      : `${count} ${name} online assessment ${count === 1 ? 'question' : 'questions'}, ${judged} judge-ready. Read each statement, then solve it in Python, Java, C++ or Go in the CSWork workspace.`;
  return { ...data, ready, locale, name, lead };
});

export async function generateMetadata({ params }: Props) {
  const { company, locale, name, lead } = await load((await params).company);
  return seoMetadata({
    title: oaPageTitle(locale, name),
    description: lead,
    path: oaCompanyPath(company.slug),
  });
}

export default async function OaCompanyPage({ params }: Props) {
  const { company, items, ready, locale, name, lead } = await load(
    (await params).company,
  );
  const zh = locale === 'zh';
  const preset = company.slug !== OTHER_COMPANY ? mockPresetFor(company.slug) : undefined;
  const mock = company.ready > 0 ? (preset?.slug ?? null) : null;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: 'OA', path: '/oa' },
            { name, path: oaCompanyPath(company.slug) },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/oa" prefetch={false}>
          OA
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{name}</span>
      </nav>
      <header className="oa-public-company-head">
        <OaCompanyMark slug={company.slug} name={name} />
        <div>
          <p className="public-library-eyebrow">
            {zh
              ? `OA 真题 · ${company.count} 题 · ${company.ready} 可判`
              : `ONLINE ASSESSMENT · ${company.count} PROBLEMS · ${company.ready} READY`}
          </p>
          <h1>{zh ? `${name} OA 真题` : `${name} OA questions`}</h1>
          <p className="public-library-summary">{lead}</p>
        </div>
      </header>
      {preset && <OaExamFormat preset={preset} updated={MOCK_PRESETS_UPDATED} zh={zh} />}
      <div className="oa-public-actions">
        {/* A mock needs a preset page and only draws judge-ready problems. */}
        {mock && (
          <a className="oa-public-cta" href={`/mock-oa/${mock}`}>
            {zh ? `模拟 ${name} OA` : `Mock ${name} OA`}
          </a>
        )}
        <a
          className="oa-public-cta is-quiet"
          href={`/?${new URLSearchParams({
            view: 'problems',
            library: 'oa',
            company: company.slug,
            // The workspace lists practice-ready problems unless told otherwise.
            ...(company.ready ? {} : { ready: '0' }),
          })}`}
        >
          {zh ? '在练习工作台中筛选' : 'Open in the workspace'}
        </a>
        {/* Every employer with OA problems has a company page. */}
        {company.slug !== OTHER_COMPANY && (
          <Link className="oa-public-cta is-quiet" href={companyHubPath(company.slug)} prefetch={false}>
            {zh ? `${name} 面经、面试题与高频题` : `${name} interview prep`}
          </Link>
        )}
      </div>
      <ol className="oa-public-list" aria-label={zh ? `${name} OA 题目` : `${name} OA problems`}>
        {items.map((item) => (
          <li key={item.id}>
            <a href={oaProblemPath(item.companySlug, item.id)}>
              <span className="oa-public-number">#{item.number}</span>
              <span className="oa-public-title">
                {item.title}
                {(item.topics.length > 0 || item.kind) && (
                  <span className="oa-public-topics">{oaTopicLine(item, zh)}</span>
                )}
              </span>
              {item.judgeStatus === 'ready' ? (
                <OaDifficulty
                  {...oaDifficulty(item.id, ready.get(item.id)?.difficulty)}
                  locale={locale}
                />
              ) : (
                <span className="oa-public-chip" data-level="reading">
                  {zh ? '仅题面' : 'Statement only'}
                </span>
              )}
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}
