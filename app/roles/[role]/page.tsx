import { notFound } from 'next/navigation';
import { cache } from 'react';
import { library } from '@/lib/server/content-library';
import { facetPage } from '@/lib/server/seo-facets';
import { FacetView, facetMetadata } from '../../company/facet-view';

/** /roles/<role>: every company's experiences and questions for one role (lib/server/seo-facets.ts). */
type Props = { params: Promise<{ role: string }> };
const load = cache(async (params: Props['params']) => {
  const page = facetPage(library(), 'role', (await params).role.slice(0, 80));
  if (!page) notFound();
  return page;
});
export async function generateMetadata({ params }: Props) {
  return facetMetadata(await load(params));
}
export default async function RolePage({ params }: Props) {
  return <FacetView page={await load(params)} />;
}
