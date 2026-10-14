import Link from 'next/link';
import { SITE_URL, seoMetadata } from '@/lib/seo';
import { KINDS, TEMPLATES, kindSummary } from '@/lib/mock-interview';
import { library } from '@/lib/server/content-library';
import { landingCompanies } from '@/lib/server/mock-interview';

const description =
  'Draw a realistic interview set from real company questions: SWE phone screens, onsite loops, behavioral rounds, data science and ML interviews. Practice on a timer or run it with a partner.';

export function generateMetadata() {
  return seoMetadata({ title: 'Mock interview generator', description, path: '/mock-interview' });
}

export default function MockInterviewLanding() {
  const db = library();
  const companies = db ? landingCompanies(db) : [];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Mock interview generator',
            description,
            url: `${SITE_URL}/mock-interview`,
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: companies.slice(0, 50).map((c, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: `${c.name} mock interview`,
                url: `${SITE_URL}/mock-interview/${c.slug}`,
              })),
            },
          }).replace(/</g, '\\u003c'),
        }}
      />
      <div className="public-library-intro">
        <p className="public-library-eyebrow">DRAW. PRACTICE. GET FEEDBACK.</p>
        <h1>Mock interviews from real company questions.</h1>
        <p>{description}</p>
      </div>
      <p className="mock-landing-cta">
        <Link href="/?view=mock-interview" prefetch={false}>
          Draw a set now →
        </Link>
      </p>
      <section className="mock-landing-section" aria-labelledby="mock-templates">
        <h2 id="mock-templates">Interview templates</h2>
        <ul className="mock-landing-templates">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <h3>{t.name[1]}</h3>
              <p>{t.blurb[1]}</p>
              <ol>
                {t.slots.map((s, i) => (
                  <li key={i}>
                    {(s.name ?? KINDS[s.kind].name)[1]} <span>{s.minutes} min</span>
                  </li>
                ))}
              </ol>
              <a href={`/?view=mock-interview&template=${t.id}`}>Start this interview →</a>
            </li>
          ))}
        </ul>
      </section>
      {companies.length > 0 && (
        <section className="mock-landing-section" aria-labelledby="mock-companies">
          <h2 id="mock-companies">Practice by company</h2>
          <ul className="mock-landing-companies">
            {companies.map((c) => (
              <li key={c.slug}>
                <a href={`/mock-interview/${c.slug}`}>{c.name}</a>
                <span>
                  {c.n} questions · {kindSummary(c.kinds, 2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
