'use client';

import { useLanguage, useT } from '@/lib/i18n';
import { homeCopy } from '@/lib/seo';
import Link from 'next/link';

/** Visible to readers as well as crawlers, including before bootstrap completes. */
export function WorkspaceIntro() {
  const t = useT();
  const copy = homeCopy(useLanguage());
  return (
    <section className="mb-6" aria-labelledby="workspace-intro-title">
      <h1
        id="workspace-intro-title"
        className="text-xl font-semibold sm:text-2xl"
      >
        {copy.heading}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
        {copy.intro}
      </p>
      <nav
        className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium"
        aria-label={t('公开学习资料', 'Public learning resources')}
      >
        <Link prefetch={false} className="underline underline-offset-4" href="/oa">
          {t('公司 OA 真题', 'Company OA questions')}
        </Link>
        <Link prefetch={false} className="underline underline-offset-4" href="/topics">
          {t('算法题路线', 'Algorithm problems by topic')}
        </Link>
        <Link
          prefetch={false}
          className="underline underline-offset-4"
          href="/library"
        >
          {t('浏览面试资料', 'Browse interview resources')}
        </Link>
        <Link
          prefetch={false}
          className="underline underline-offset-4"
          href="/library?type=algorithm"
        >
          {t('算法专题', 'Algorithm tutorials')}
        </Link>
        <Link
          prefetch={false}
          className="underline underline-offset-4"
          href="/library?type=guide"
        >
          {t('公司面试指南', 'Company interview guides')}
        </Link>
        <Link
          prefetch={false}
          className="underline underline-offset-4"
          href="/library?type=experience"
        >
          {t('面试经历', 'Interview experiences')}
        </Link>
      </nav>
    </section>
  );
}
