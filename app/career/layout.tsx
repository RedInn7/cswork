import '../mock-oa/mock-oa-public.css';
import '../guide/guide.css';
import { requestLocale } from '@/lib/server/locale';
import { GuideShell } from '../guide/shell';

export default async function CareerLayout({ children }: { children: React.ReactNode }) {
  return <GuideShell zh={(await requestLocale()) === 'zh'}>{children}</GuideShell>;
}
