import Link from 'next/link';
import { ProjectState } from '@/components/project-progress';
import { ROLES, isRole } from '@/lib/content/role-paths';
import { LEVEL_NAMES, PROJECT_LEVELS } from '@/lib/resume-projects';
import { SITE_NAME, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { resumeProjects } from '@/lib/server/resume-projects';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const COPY = {
  zh: {
    title: `简历项目：${resumeProjects.length} 个带验收脚本的后端与数据项目 | ${SITE_NAME}`,
    description:
      '限流服务、排行榜、LRU 缓存、任务队列、日志检索、幂等 ETL、礼貌爬虫、Feature flag、带 WAL 的 KV 存储和 Mini Redis。每个项目有需求说明、里程碑、只用 Python 标准库的黑盒验收脚本、简历要点模板和面试官常问的追问，语言不限。',
    eyebrow: '简历项目 · 验收脚本 · 面试追问',
    heading: '做一个能写进简历、也经得起追问的项目。',
  },
  en: {
    title: `Resume Projects: ${resumeProjects.length} Backend & Data Builds with Acceptance Tests | ${SITE_NAME}`,
    description:
      'A rate limiter, a leaderboard, an LRU cache, a task queue, log search, an idempotent ETL, a polite crawler, feature flags, a key-value store with a WAL and a mini Redis. Each comes with a brief, milestones, a black-box acceptance script that needs only the Python standard library, a resume bullet template and the follow-up questions interviewers ask. Build it in any language.',
    eyebrow: 'RESUME PROJECTS · ACCEPTANCE TESTS · FOLLOW-UPS',
    heading: 'Build a project worth a resume line, and ready for the follow-ups.',
  },
};
const LEVEL_LEADS: Record<string, [string, string]> = {
  beginner: ['一个周末到一周：一个服务、一个核心数据结构、并发安全。', 'A weekend to a week: one service, one core data structure, safe under concurrency.'],
  intermediate: ['一到两周：多个状态、失败和重试、可以讲很多取舍。', 'One to two weeks: more state, failures and retries, and plenty of trade-offs to discuss.'],
  advanced: ['两周以上：协议、磁盘和崩溃恢复，面试里最能聊深的那种。', 'Two weeks or more: protocols, disks and crash recovery, the kind that carries a deep interview.'],
};

export async function generateMetadata() {
  const c = COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/projects' });
}

/** /projects: the resume projects by level, filtered by role with ?role=; progress badges once signed in. */
export default async function ProjectsPage({ searchParams }: Props) {
  const zh = (await requestLocale()) === 'zh';
  const c = COPY[zh ? 'zh' : 'en'];
  const raw = (await searchParams).role;
  const role = isRole(raw) ? raw : null;
  const shown = resumeProjects.filter((p) => !role || p.roles.includes(role));
  const roleName = (key: keyof typeof ROLES) => (zh ? ROLES[key].zh : ROLES[key].en);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: zh ? '简历项目' : 'Resume projects', path: '/projects' },
          ]),
        }}
      />
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p>{c.description}</p>
      </div>
      <ol className="projects-how">
        <li>{zh ? '读需求，按里程碑一步步做，语言和框架随你。' : 'Read the brief and work through the milestones in any language or framework.'}</li>
        <li>
          {zh
            ? '下载验收脚本，在自己电脑上对着你的程序跑，全部通过才算做完。'
            : 'Download the acceptance script and run it against your program on your own machine; done means every check passes.'}
        </li>
        <li>{zh ? '照着模板写简历要点，再把追问题自己答一遍。' : 'Write the resume bullet from the template, then answer the follow-up questions yourself.'}</li>
      </ol>
      <nav className="public-library-filters" aria-label={zh ? '按岗位筛选' : 'Filter by role'}>
        <a href="/projects" aria-current={role ? undefined : 'page'}>
          {zh ? '全部' : 'All'}
        </a>
        {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((key) => (
          <a key={key} href={`/projects?role=${key}`} aria-current={key === role ? 'page' : undefined}>
            {roleName(key)}
          </a>
        ))}
      </nav>
      <p className="public-library-count">
        {zh ? `${shown.length} 个项目` : `${shown.length} ${shown.length === 1 ? 'project' : 'projects'}`}
        {role && (zh ? ` · 适合${roleName(role)}` : ` for ${roleName(role)}`)}
      </p>
      {PROJECT_LEVELS.map((level) => {
        const items = shown.filter((p) => p.level === level);
        if (!items.length) return null;
        const [name, nameEn] = LEVEL_NAMES[level];
        return (
          <section className="projects-level" key={level} aria-labelledby={`projects-${level}`}>
            <h2 id={`projects-${level}`}>{zh ? name : nameEn}</h2>
            <p>{LEVEL_LEADS[level][zh ? 0 : 1]}</p>
            <ul className="projects-grid">
              {items.map((p) => (
                <li className="projects-card" key={p.slug}>
                  <h3>
                    <Link href={`/projects/${p.slug}`} prefetch={false}>
                      {zh ? p.titleZh : p.titleEn}
                    </Link>
                  </h3>
                  <p>{zh ? p.summaryZh : p.summaryEn}</p>
                  <p className="projects-meta">
                    <span>{zh ? `约 ${p.hours} 小时` : `~${p.hours} h`}</span>
                    <span>{p.roles.map((r) => (isRole(r) ? roleName(r) : r)).join(zh ? '、' : ', ')}</span>
                  </p>
                  <ProjectState slug={p.slug} zh={zh} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
