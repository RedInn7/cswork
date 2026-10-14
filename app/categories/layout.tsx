import { FacetShell } from '../company/facet-view';

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return <FacetShell section={['题目类别', 'categories']}>{children}</FacetShell>;
}
