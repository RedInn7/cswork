import '../../../editor.css';
import '../../../ai-assisted/ai-assisted.css';
import '../ica.css';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IcaWorkspace } from '@/components/ica-workspace';
import { breadcrumbJsonLd, SITE_NAME, seoMetadata } from '@/lib/seo';
import { icaTask } from '@/lib/server/ai-tasks';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { icaView } from '@/lib/server/ica';
import { requestLocale } from '@/lib/server/locale';

type Props = { params: Promise<{ task: string }> };

async function load(params: Props['params']) {
  const task = icaTask((await params).task);
  if (!task) notFound();
  return { task, zh: (await requestLocale()) === 'zh' };
}

export async function generateMetadata({ params }: Props) {
  const { task, zh } = await load(params);
  return seoMetadata({
    title: `${task.title[zh ? 0 : 1]} · ${zh ? 'CodeSignal ICA 式练习' : 'CodeSignal ICA-style practice'} | ${SITE_NAME}`,
    description: task.summary[zh ? 0 : 1],
    path: `/oa/ica/${task.slug}`,
  });
}

/** /oa/ica/<task>: the level bar, the open level's brief and the workspace; hidden tests stay on the server. */
export default async function IcaTaskPage({ params }: Props) {
  const { task, zh } = await load(params);
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const title = task.title[zh ? 0 : 1];
  return (
    <article className="ica-round">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: 'OA', path: '/oa' },
            { name: 'ICA', path: '/oa/ica' },
            { name: title, path: `/oa/ica/${task.slug}` },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/oa" prefetch={false}>
          OA
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/oa/ica" prefetch={false}>
          ICA
        </Link>
      </nav>
      <header className="ica-head">
        <p className="ai-round-chip">
          {zh ? `ICA 式 · ${task.levels.length} 关 · 约 ${task.minutes} 分钟 · 不可用 AI` : `ICA-style · ${task.levels.length} levels · ~${task.minutes} min · no AI`}
        </p>
        <h1>{title}</h1>
        <p>{task.summary[zh ? 0 : 1]}</p>
      </header>
      <IcaWorkspace
        slug={task.slug}
        minutes={task.minutes}
        starter={task.files}
        initial={icaView(viewer?.id ?? null, task.slug)!}
        signedIn={!!viewer}
        verified={!!viewer && (viewer.verified || viewer.role === 'teacher')}
      />
    </article>
  );
}
