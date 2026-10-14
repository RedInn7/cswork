import { FacetShell } from '../company/facet-view';

export default function RolesLayout({ children }: { children: React.ReactNode }) {
  return <FacetShell section={['岗位', 'roles']}>{children}</FacetShell>;
}
