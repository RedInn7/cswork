import { notFound } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';
import { seoMetadata } from '@/lib/seo';
import {
  PUBLIC_LIBRARY_TYPES,
  parsePublicLibraryQuery,
  publicLibraryList,
  publicLibraryListPath,
  publicLibraryPath,
  type PublicLibraryType,
} from '@/lib/server/public-library';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const introduction =
  'Explore algorithm tutorials, coding and system design questions, interview experiences, and computer science study guides.';
const readPage = cache((type: PublicLibraryType | undefined, page: number) =>
  publicLibraryList({ type, page }),
);

async function load(searchParams: Props['searchParams']) {
  const query = parsePublicLibraryQuery(await searchParams);
  if (!query) notFound();
  const result = readPage(query.type, query.page);
  if (!result) notFound();
  return { query, result };
}

export async function generateMetadata({ searchParams }: Props) {
  const { query } = await load(searchParams);
  const title = query.type
    ? PUBLIC_LIBRARY_TYPES[query.type]
    : 'Interview preparation library';
  return {
    ...seoMetadata({
      title: title + (query.page > 1 ? ` · Page ${query.page}` : ''),
      description: introduction,
      path: publicLibraryListPath(query),
    }),
    ...(query.type === 'guide'
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

export default async function LibraryPage({ searchParams }: Props) {
  const { query, result } = await load(searchParams);
  return (
    <>
      <div className="public-library-intro">
        <p className="public-library-eyebrow">READ. UNDERSTAND. PRACTICE.</p>
        <h1>
          {query.type
            ? PUBLIC_LIBRARY_TYPES[query.type]
            : 'Prepare for your next interview.'}
        </h1>
        <p>{introduction}</p>
      </div>
      <nav className="public-library-filters" aria-label="Library topics">
        <Link
          href="/library"
          prefetch={false}
          aria-current={!query.type ? 'page' : undefined}
        >
          All topics
        </Link>
        {Object.entries(PUBLIC_LIBRARY_TYPES).map(([type, title]) => (
          <a
            key={type}
            href={`/library?type=${type}`}
            aria-current={query.type === type ? 'page' : undefined}
          >
            {title}
          </a>
        ))}
      </nav>
      <p className="public-library-count">
        {result.total.toLocaleString('en-US')} resources · Page {query.page} of{' '}
        {result.pages}
      </p>
      {result.items.length ? (
        <ol className="public-library-list">
          {result.items.map((item) => (
            <li key={`${item.type}/${item.slug}`}>
              <p className="public-library-label">
                {PUBLIC_LIBRARY_TYPES[item.type]}
                {item.company ? ` · ${item.company}` : ''}
              </p>
              <h2>
                <a href={publicLibraryPath(item.type, item.slug)}>
                  {item.title}
                </a>
              </h2>
              {item.summary && <p>{item.summary}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="public-library-empty">
          Resources are being prepared. You can explore the{' '}
          <Link href="/?view=problems" prefetch={false}>
            practice workspace
          </Link>{' '}
          in the meantime.
        </p>
      )}
      <nav className="public-library-pagination" aria-label="Library pages">
        {query.page > 1 ? (
          <a
            rel="prev"
            href={publicLibraryListPath({ ...query, page: query.page - 1 })}
          >
            ← Previous page
          </a>
        ) : (
          <span />
        )}
        {query.page < result.pages && (
          <a
            rel="next"
            href={publicLibraryListPath({ ...query, page: query.page + 1 })}
          >
            Next page →
          </a>
        )}
      </nav>
    </>
  );
}
