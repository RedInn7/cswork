import { notFound } from 'next/navigation';
import { SITE_NAME, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { englishUnit, englishUnits } from '@/lib/interview-english';
import { EnglishUnit } from '@/components/english-unit';

type Props = { params: Promise<{ unit: string }> };

async function load(params: Props['params']) {
  const unit = englishUnit((await params).unit);
  if (!unit) notFound();
  return { unit, zh: (await requestLocale()) === 'zh' };
}

export async function generateMetadata({ params }: Props) {
  const { unit, zh } = await load(params);
  return seoMetadata({
    title: `${zh ? unit.title.zh : unit.title.en} · ${zh ? '面试英语' : 'Interview English'} | ${SITE_NAME}`,
    description: zh ? unit.blurb.zh : unit.blurb.en,
    path: `/english/${unit.slug}`,
  });
}

/** /english/<unit>: the unit's heading on the server, its phrases, dialogue and drills in the browser. */
export default async function EnglishUnitPage({ params }: Props) {
  const { unit, zh } = await load(params);
  const t = (a: string, b: string) => (zh ? a : b);
  const title = (u: typeof unit) => (zh ? u.title.zh : u.title.en);
  const at = englishUnits.indexOf(unit);
  const prev = englishUnits[at - 1];
  const next = englishUnits[at + 1];
  return (
    <article className="eng-article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: t('面试英语', 'Interview English'), path: '/english' },
            { name: title(unit), path: `/english/${unit.slug}` },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={t('导航路径', 'Breadcrumb')}>
        <a href="/english">{t('面试英语', 'Interview English')}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{title(unit)}</span>
      </nav>
      <header className="eng-head">
        <p className="public-library-eyebrow">
          {t(`单元 ${at + 1} / ${englishUnits.length}`, `UNIT ${at + 1} OF ${englishUnits.length}`)}
        </p>
        <h1>{title(unit)}</h1>
        <p className="public-library-summary">{zh ? unit.blurb.zh : unit.blurb.en}</p>
      </header>
      <EnglishUnit key={unit.slug} unit={unit} />
      <nav className="eng-pager" aria-label={t('单元导航', 'Units')}>
        {prev ? (
          <a href={`/english/${prev.slug}`} rel="prev">
            <span>{t('上一单元', 'Previous')}</span>
            {title(prev)}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a href={`/english/${next.slug}`} rel="next">
            <span>{t('下一单元', 'Next')}</span>
            {title(next)}
          </a>
        ) : (
          <a href="/mock-interview">
            <span>{t('学完了', 'All done')}</span>
            {t('来一场模拟面试', 'Run a mock interview')}
          </a>
        )}
      </nav>
    </article>
  );
}
