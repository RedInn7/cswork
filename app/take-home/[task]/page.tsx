import '../../editor.css';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TakeHomeWorkspace } from '@/components/take-home-workspace';
import { SITE_NAME, seoMetadata } from '@/lib/seo';
import { aiEnabled } from '@/lib/server/ai-tutor';
import { aiTask } from '@/lib/server/ai-tasks';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { GuideMarkdown } from '../../guide/markdown';

type Props = { params: Promise<{ task: string }> };

async function load(params: Props['params']) {
  const task = aiTask((await params).task);
  if (!task || task.track !== 'take-home') notFound();
  return { task, zh: (await requestLocale()) === 'zh' };
}

export async function generateMetadata({ params }: Props) {
  const { task, zh } = await load(params);
  return seoMetadata({
    title: `${task.title[zh ? 0 : 1]} · ${zh ? '带回家作业练习' : 'Take-home practice'} | ${SITE_NAME}`,
    description: task.summary[zh ? 0 : 1],
    path: `/take-home/${task.slug}`,
  });
}

/** /take-home/<task>: the brief, then the timed workspace without the AI pair; the hidden suite never leaves the server. */
export default async function TakeHomeTask({ params }: Props) {
  const { task, zh } = await load(params);
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <article>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/take-home" prefetch={false}>
          {zh ? '带回家作业' : 'Take-home'}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{task.title[zh ? 0 : 1]}</span>
      </nav>
      <section className="ai-round-readme">
        <p className="ai-round-chip">
          {task.kind[zh ? 0 : 1]} · {zh ? `约 ${task.minutes / 60} 小时 · 不可用 AI` : `~${task.minutes / 60} h · no AI`}
        </p>
        <h1>{task.title[zh ? 0 : 1]}</h1>
        {/* The README's own title is the heading above. */}
        <GuideMarkdown
          body={task.readme[zh ? 'zh' : 'en'].replace(/^# .*\n+/, '')}
          labels={{ table: zh ? '表格' : 'Table', code: zh ? '代码' : 'Code' }}
        />
      </section>
      <TakeHomeWorkspace
        slug={task.slug}
        minutes={task.minutes}
        files={task.files}
        hiddenTotal={task.hiddenTotal}
        signedIn={!!viewer}
        verified={!!viewer && (viewer.verified || viewer.role === 'teacher')}
        ai={aiEnabled()}
      />
    </article>
  );
}
