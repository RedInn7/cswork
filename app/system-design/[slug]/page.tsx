import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_NAME, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { sdChapter, sdChapters, sdPath, sdSummary } from '@/lib/server/system-design-course';
import { PublicLibraryMarkdown } from '../../library/markdown';
import { SdQuiz } from '../quiz';

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props['params']) {
  const chapter = sdChapter((await params).slug);
  if (!chapter) notFound();
  return { chapter, zh: (await requestLocale()) === 'zh' };
}

export async function generateMetadata({ params }: Props) {
  const { chapter, zh } = await load(params);
  return seoMetadata({
    title: `${zh ? chapter.titleZh : chapter.titleEn} · ${zh ? '系统设计面试课' : 'System Design Course'} | ${SITE_NAME}`,
    description: sdSummary(zh ? chapter.bodyZh : chapter.bodyEn, 160),
    path: sdPath(chapter.slug),
  });
}

export default async function SystemDesignChapter({ params }: Props) {
  const { chapter, zh } = await load(params);
  const t = (a: string, b: string) => (zh ? a : b);
  const at = sdChapters.indexOf(chapter);
  const prev = sdChapters[at - 1];
  const next = sdChapters[at + 1];
  const title = (c: typeof chapter) => (zh ? c.titleZh : c.titleEn);
  return (
    <article className="public-library-article sd-chapter">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: t('系统设计', 'System design'), path: sdPath() },
            { name: title(chapter), path: sdPath(chapter.slug) },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={t('面包屑', 'Breadcrumb')}>
        <Link href="/" prefetch={false}>
          {SITE_NAME}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={sdPath()} prefetch={false}>
          {t('系统设计', 'System design')}
        </Link>
      </nav>
      <header className="public-library-article-header sd-chapter-header">
        <p className="sd-sheet-no">
          {t(`第 ${at + 1} 章 / 共 ${sdChapters.length} 章`, `Chapter ${at + 1} of ${sdChapters.length}`)}
        </p>
        <h1>{title(chapter)}</h1>
      </header>
      <div className="public-library-prose">
        <PublicLibraryMarkdown body={zh ? chapter.bodyZh : chapter.bodyEn} math={false} />
      </div>
      {chapter.quiz.length > 0 && <SdQuiz slug={chapter.slug} quiz={chapter.quiz} zh={zh} />}
      <nav className="sd-pager" aria-label={t('章节导航', 'Chapters')}>
        {prev ? (
          <a href={sdPath(prev.slug)} rel="prev">
            <span>{t('上一章', 'Previous')}</span>
            {title(prev)}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a href={sdPath(next.slug)} rel="next">
            <span>{t('下一章', 'Next')}</span>
            {title(next)}
          </a>
        ) : (
          <a href={sdPath()}>
            <span>{t('学完了', 'Finished')}</span>
            {t('回到课程目录', 'Back to all chapters')}
          </a>
        )}
      </nav>
    </article>
  );
}
