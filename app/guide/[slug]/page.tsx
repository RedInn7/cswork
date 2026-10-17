import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { seoMetadata } from '@/lib/seo';
import { guideChapter, guidePath } from '@/lib/career-guide';
import { CAREER_CHECKLISTS } from '@/lib/content/career-checklists';
import { GuideChecklist } from '@/components/guide-checklist';
import { requestLocale } from '@/lib/server/locale';
import { GuideChapterView, guideChapterCopy } from '../views';

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props['params']) {
  const chapter = guideChapter((await params).slug);
  if (!chapter) notFound();
  return { chapter, zh: (await requestLocale()) === 'zh' };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chapter, zh } = await load(params);
  const { pageTitle, description } = guideChapterCopy(chapter, zh);
  return seoMetadata({ title: pageTitle, description, path: guidePath(chapter.slug) });
}

export default async function GuideChapterPage({ params }: Props) {
  const { chapter, zh } = await load(params);
  const checklist = CAREER_CHECKLISTS[chapter.slug];
  return (
    <GuideChapterView chapter={chapter} zh={zh}>
      {checklist && <GuideChecklist slug={chapter.slug} items={checklist} zh={zh} />}
    </GuideChapterView>
  );
}
