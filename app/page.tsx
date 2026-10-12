import { Academy } from '@/components/academy';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  // Workspace states, invitation tokens and checkout returns are not landing pages.
  const hasQuery = Object.keys(await searchParams).length > 0;
  return {
    alternates: { canonical: SITE_URL },
    robots: { index: !hasQuery, follow: true },
  };
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'CSWork',
            url: SITE_URL,
            description:
              'Coding practice, online assessments and software engineering interview preparation.',
          }).replace(/</g, '\\u003c'),
        }}
      />
      <Academy />
    </>
  );
}
