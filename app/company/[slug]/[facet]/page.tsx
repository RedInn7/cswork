import { notFound } from 'next/navigation';
import { cache } from 'react';
import { library } from '@/lib/server/content-library';
import { facetPage, parseFacet } from '@/lib/server/seo-facets';
import { FacetView, facetMetadata } from '../../facet-view';

/** /company/<employer>/role-<role> and /company/<employer>/cat-<category> (lib/server/seo-facets.ts). */
type Props = { params: Promise<{ slug: string; facet: string }> };
const load = cache(async (params: Props['params']) => {
  const { slug, facet } = await params;
  const parsed = parseFacet(facet);
  const page = parsed && facetPage(library(), parsed.kind, parsed.slug, slug);
  if (!page) notFound();
  return page;
});
export async function generateMetadata({ params }: Props) {
  return facetMetadata(await load(params));
}
export default async function CompanyFacetPage({ params }: Props) {
  return <FacetView page={await load(params)} />;
}
