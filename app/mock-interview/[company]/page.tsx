import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SITE_URL, seoMetadata } from '@/lib/seo';
import { KINDS, TEMPLATES, companyGroup, kindOf, kindSummary, type KindId } from '@/lib/mock-interview';
import { CompanyStatsCard } from '@/components/company-stats-card';
import { employerSlug } from '@/lib/oa-company-brands';
import { companyDirectory } from '@/lib/server/company-hub';
import { companyStats } from '@/lib/server/company-stats';
import { library } from '@/lib/server/content-library';
import { landingCompanies, mockPool } from '@/lib/server/mock-interview';
import { publicLibraryPath } from '@/lib/server/public-library';

type Props = { params: Promise<{ company: string }> };

async function load(params: Props['params']) {
  const { company: slug } = await params;
  const db = library();
  const company = db && landingCompanies(db).find((c) => c.slug === slug);
  if (!db || !company) notFound();
  // A few of its own questions per kind that have a public page.
  const group = companyGroup(company.slug);
  const samples = new Map<KindId, { type: string; slug: string; title: string }[]>();
  for (const item of mockPool(db)) {
    const kind = kindOf(item.category);
    if (!kind || !item.listed || !item.company || !group.includes(item.company)) continue;
    const list = samples.get(kind) ?? [];
    if (list.length < 5) samples.set(kind, [...list, item]);
  }
  // Stats over every library spelling of the employer (none for a hidden one).
  const stats = companyStats(db, companyDirectory(db).get(employerSlug(company.slug))?.library ?? []);
  return { company, samples, stats };
}

export async function generateMetadata({ params }: Props) {
  const { company } = await load(params);
  return seoMetadata({
    title: `${company.name} mock interview questions`,
    description: `Practice a ${company.name} interview with ${company.n} real questions (${kindSummary(company.kinds)}). Draw a timed set in one click, or run it with a partner as the interviewer.`,
    path: `/mock-interview/${company.slug}`,
  });
}

export default async function CompanyMockInterview({ params }: Props) {
  const { company, samples, stats } = await load(params);
  const url = `${SITE_URL}/mock-interview/${company.slug}`;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${company.name} mock interview questions`,
            url,
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Mock interview', item: `${SITE_URL}/mock-interview` },
                { '@type': 'ListItem', position: 2, name: company.name, item: url },
              ],
            },
          }).replace(/</g, '\\u003c'),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label="Breadcrumb">
        <Link href="/mock-interview" prefetch={false}>
          Mock interview
        </Link>
        <span aria-hidden="true">/</span>
        <span>{company.name}</span>
      </nav>
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{company.n} REAL QUESTIONS</p>
        <h1>{company.name} mock interview questions.</h1>
        <p>
          Draw a {company.name} interview set from questions candidates were really asked: {kindSummary(company.kinds, 7)}.
          When a kind runs short, similar questions from other companies fill in and are marked as such.
        </p>
      </div>
      <p className="mock-landing-cta">
        <a href={`/?view=mock-interview&company=${encodeURIComponent(company.slug)}`}>Draw a {company.name} set →</a>
      </p>
      {stats && <CompanyStatsCard stats={stats} locale="en" />}
      <section className="mock-landing-section" aria-labelledby="mock-templates">
        <h2 id="mock-templates">Pick a round</h2>
        <ul className="mock-landing-templates">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <h3>{t.name[1]}</h3>
              <p>{t.blurb[1]}</p>
              <a href={`/?view=mock-interview&template=${t.id}&company=${encodeURIComponent(company.slug)}`}>
                Start a {company.name} {t.name[1]} →
              </a>
            </li>
          ))}
        </ul>
      </section>
      {[...samples].map(([kind, items]) => (
        <section key={kind} className="mock-landing-section" aria-labelledby={`mock-${kind}`}>
          <h2 id={`mock-${kind}`}>
            {KINDS[kind].name[1]} <small>{company.kinds[kind]} questions</small>
          </h2>
          <ul className="mock-landing-questions">
            {items.map((item) => (
              <li key={item.slug}>
                <a href={publicLibraryPath(item.type, item.slug)}>{item.title}</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
