import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectProgress } from '@/components/project-progress';
import { ROLES, isRole } from '@/lib/content/role-paths';
import { LEVEL_NAMES } from '@/lib/resume-projects';
import { SITE_NAME, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { resumeProject, type ResumeProject } from '@/lib/server/resume-projects';
import { GuideMarkdown } from '../../guide/markdown';

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props['params']) {
  const project = resumeProject((await params).slug);
  if (!project) notFound();
  return { project, zh: (await requestLocale()) === 'zh' };
}

/** How to point the acceptance script at the learner's program. */
const RUN: Record<ResumeProject['run'], { command: string; zh: string; en: string }> = {
  http: {
    command: 'BASE_URL=http://127.0.0.1:8080 python3 accept_test.py',
    zh: '先启动你的服务，把 BASE_URL 换成它监听的地址。',
    en: 'Start your service first and set BASE_URL to the address it listens on.',
  },
  tcp: {
    command: 'BASE_URL=tcp://127.0.0.1:6379 python3 accept_test.py',
    zh: '先启动你的服务器，把 BASE_URL 换成它监听的地址和端口。',
    en: 'Start your server first and set BASE_URL to the host and port it listens on.',
  },
  cmd: {
    command: 'CMD="python3 your_program.py" python3 accept_test.py',
    zh: '把 CMD 换成启动你程序的命令，脚本会自己带上参数运行它。',
    en: 'Set CMD to the command that starts your program; the script runs it with the arguments it needs.',
  },
};

export async function generateMetadata({ params }: Props) {
  const { project, zh } = await load(params);
  return seoMetadata({
    title: `${zh ? project.titleZh : project.titleEn} · ${zh ? '简历项目' : 'Resume project'} | ${SITE_NAME}`,
    description: zh ? project.summaryZh : project.summaryEn,
    path: `/projects/${project.slug}`,
  });
}

/** /projects/<slug>: the brief, milestones, resume bullet, follow-up questions and the acceptance script. */
export default async function ProjectPage({ params }: Props) {
  const { project, zh } = await load(params);
  const t = (cn: string, en: string) => (zh ? cn : en);
  const title = zh ? project.titleZh : project.titleEn;
  const run = RUN[project.run];
  return (
    <article className="public-library-article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: t('简历项目', 'Resume projects'), path: '/projects' },
            { name: title, path: `/projects/${project.slug}` },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={t('导航路径', 'Breadcrumb')}>
        <Link href="/projects" prefetch={false}>
          {t('简历项目', 'Resume projects')}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{title}</span>
      </nav>
      <header className="public-library-article-header">
        <ul className="project-facts" aria-label={t('项目信息', 'About this project')}>
          <li>{LEVEL_NAMES[project.level][zh ? 0 : 1]}</li>
          <li>{t(`约 ${project.hours} 小时`, `~${project.hours} hours`)}</li>
          {project.roles.filter(isRole).map((role) => (
            <li key={role}>
              <a href={`/projects?role=${role}`}>{zh ? ROLES[role].zh : ROLES[role].en}</a>
            </li>
          ))}
        </ul>
        <h1>{title}</h1>
        <p className="public-library-summary">{zh ? project.summaryZh : project.summaryEn}</p>
      </header>
      <ProjectProgress slug={project.slug} zh={zh} />
      <div className="public-library-prose">
        <GuideMarkdown body={zh ? project.briefZh : project.briefEn} labels={{ table: t('表格', 'Table'), code: t('代码', 'Code') }} />

        <h2 id="milestones">{t('里程碑', 'Milestones')}</h2>
        <ol>
          {project.milestones.map((m) => (
            <li key={m.en}>{zh ? m.zh : m.en}</li>
          ))}
        </ol>

        <h2 id="accept">{t('验收脚本', 'Acceptance script')}</h2>
        <p>
          {t(
            '一个只用 Python 标准库（3.9 及以上）的黑盒测试，从外部检查你的程序是否符合上面的需求。每一项打印 PASS 或 FAIL 和原因，全部通过时退出码为 0。',
            'A black-box test that needs only the Python standard library (3.9 or later) and checks your program against the brief from the outside. Each check prints PASS or FAIL with the reason, and the exit code is 0 when all of them pass.',
          )}
        </p>
        <p>
          <a className="project-download" href={`/projects/${project.slug}/accept`} download="accept_test.py">
            {t('下载 accept_test.py', 'Download accept_test.py')}
          </a>
        </p>
        <p>{zh ? run.zh : run.en}</p>
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard-reachable. */}
        <pre role="region" aria-label={t('运行命令', 'Command')} tabIndex={0}>
          <code>{run.command}</code>
        </pre>

        <h2 id="resume">{t('简历要点模板', 'Resume bullet template')}</h2>
        <p>
          {t(
            '把花括号里的内容换成你自己的实现和实测数字。没有测过的数字不要写，面试官一定会问。',
            'Replace the braces with your own choices and measured numbers. Leave out any number you have not measured: interviewers will ask.',
          )}
        </p>
        <blockquote lang="zh-CN">
          <p>{project.bulletZh}</p>
        </blockquote>
        <blockquote lang="en">
          <p>{project.bulletEn}</p>
        </blockquote>

        <h2 id="follow-ups">{t('面试官可能追问', 'Follow-up questions to expect')}</h2>
        <ol>
          {project.deepDive.map((q) => (
            <li key={q.en}>{zh ? q.zh : q.en}</li>
          ))}
        </ol>
      </div>
    </article>
  );
}
