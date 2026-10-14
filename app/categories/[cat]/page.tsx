import { notFound } from 'next/navigation';
import { cache } from 'react';
import { library } from '@/lib/server/content-library';
import { facetPage } from '@/lib/server/seo-facets';
import { FacetView, facetMetadata } from '../../company/facet-view';

/** /categories/<category>: every company's questions in one category (lib/server/seo-facets.ts). */
type Props = { params: Promise<{ cat: string }> };
const load = cache(async (params: Props['params']) => {
  const page = facetPage(library(), 'cat', (await params).cat.slice(0, 80));
  if (!page) notFound();
  return page;
});
export async function generateMetadata({ params }: Props) {
  return facetMetadata(await load(params));
}
export default async function CategoryPage({ params }: Props) {
  return <FacetView page={await load(params)} />;
}
