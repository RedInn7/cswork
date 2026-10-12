'use client';

import { useT } from '@/lib/i18n';
import Link from 'next/link';

/** Visible to readers as well as crawlers, including before bootstrap completes. */
export function WorkspaceIntro() {
  const t = useT();
  return (
    <section
      className="mb-8 rounded-xl border border-border bg-card p-5 sm:p-7"
      aria-labelledby="workspace-intro-title"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        CSWork
      </p>
      <h1
        id="workspace-intro-title"
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {t(
          '算法、OA 与软件工程师面试准备',
          'Coding practice and software engineering interview prep',
        )}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
        {t(
          '按专题练习算法，按公司查找 OA 题目和面经，结合系统设计与后端课程补齐基础。在 CSWork，你可以阅读公开面试资料，也可以进入学习工作台写代码、查看判题结果和记录学习进度。',
          'Practice algorithms by topic, explore company online assessments (OAs) and interview experiences, and study system design and backend engineering. Read public interview resources or use the workspace to write code, review judge results and track your learning.',
        )}
      </p>
      <nav
        className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium"
        aria-label={t('公开学习资料', 'Public learning resources')}
      >
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
