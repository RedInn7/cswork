import '../mock-oa/mock-oa-public.css';
import './guide.css';
import { requestLocale } from '@/lib/server/locale';
import { GuideShell } from './shell';

export default async function GuideLayout({ children }: { children: React.ReactNode }) {
  return <GuideShell zh={(await requestLocale()) === 'zh'}>{children}</GuideShell>;
}
