import { Academy } from '@/components/academy';
import type { Metadata } from 'next';
import { htmlLang, languagePath } from '@/lib/language';
import { homeCopy, SITE_NAME, SITE_URL } from '@/lib/seo';
import { requestLanguage, urlLanguage } from '@/lib/server/locale';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  // Workspace states, invitation tokens and checkout returns are not landing pages.
  // Title, canonical and hreflang come from app/layout.tsx.
  const hasQuery = Object.keys(await searchParams).length > 0;
  return { robots: { index: !hasQuery, follow: true } };
}

export default async function Home() {
  const copy = homeCopy(await requestLanguage());
  const language = (await urlLanguage()) ?? 'zh';
  const url = SITE_URL + languagePath(language, '/').replace(/\/$/, '');
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebSite',
                '@id': `${url}#website`,
                name: SITE_NAME,
                url,
                inLanguage: htmlLang(language),
                description: copy.description,
                publisher: { '@id': `${SITE_URL}#organization` },
              },
              {
                '@type': 'Organization',
                '@id': `${SITE_URL}#organization`,
                name: SITE_NAME,
                url: SITE_URL,
                logo: `${SITE_URL}/icons/icon-512.png`,
              },
              {
                '@type': 'WebApplication',
                name: SITE_NAME,
                url,
                applicationCategory: 'EducationalApplication',
                operatingSystem: 'Web',
                description: copy.description,
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                featureList: [
                  'Company online assessment (OA) questions',
                  'Algorithm problems with an online judge',
                  'Python, Java, C++ and Go',
                ],
              },
            ],
          }).replace(/</g, '\\u003c'),
        }}
      />
      <Academy />
    </>
  );
}
