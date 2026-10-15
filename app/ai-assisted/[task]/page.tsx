import '../../editor.css';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectWorkspace } from '@/components/project-workspace';
import { SITE_NAME, seoMetadata } from '@/lib/seo';
import { aiEnabled, AI_DAILY_LIMITS } from '@/lib/server/ai-tutor';
import { aiTask } from '@/lib/server/ai-tasks';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { GuideMarkdown } from '../../guide/markdown';

type Props = { params: Promise<{ task: string }> };

async function load(params: Props['params']) {
  const task = aiTask((await params).task);
  if (!task) notFound();
  return { task, zh: (await requestLocale()) === 'zh' };
}

export async function generateMetadata({ params }: Props) {
  const { task, zh } = await load(params);
  return seoMetadata({
    title: `${task.title[zh ? 0 : 1]} · ${zh ? 'AI 辅助编程轮练习' : 'AI-assisted round practice'} | ${SITE_NAME}`,
    description: task.summary[zh ? 0 : 1],
    path: `/ai-assisted/${task.slug}`,
  });
}

/** /ai-assisted/<task>: the brief, then the project workspace; the hidden suite never leaves the server. */
export default async function AiAssistedTask({ params }: Props) {
  const { task, zh } = await load(params);
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <article>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/ai-assisted" prefetch={false}>
          {zh ? 'AI 辅助编程轮' : 'AI-assisted round'}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{task.title[zh ? 0 : 1]}</span>
      </nav>
      <section className="ai-round-readme">
        <p className="ai-round-chip">
          {task.kind[zh ? 0 : 1]} · {zh ? `约 ${task.minutes} 分钟` : `~${task.minutes} min`}
        </p>
        <h1>{task.title[zh ? 0 : 1]}</h1>
        {/* The README's own title is the heading above. */}
        <GuideMarkdown
          body={task.readme[zh ? 'zh' : 'en'].replace(/^# .*\n+/, '')}
          labels={{ table: zh ? '表格' : 'Table', code: zh ? '代码' : 'Code' }}
        />
      </section>
      <ProjectWorkspace
        task={task.slug}
        files={task.files}
        hiddenTotal={task.hiddenTotal}
        signedIn={!!viewer}
        verified={!!viewer && (viewer.verified || viewer.role === 'teacher')}
        ai={aiEnabled()}
        aiLimit={AI_DAILY_LIMITS.pair}
      />
    </article>
  );
}
