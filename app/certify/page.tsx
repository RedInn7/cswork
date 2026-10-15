import '../lists/lists.css';
import './certify.css';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SkillTests } from '@/components/skill-test';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { skillOverview } from '@/lib/server/skill-tests';
import { LibraryPageView } from '../library/page-view';

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await requestLocale()) === 'zh';
  return seoMetadata({
    title: zh ? '技能认证：算法、SQL 与 Python 限时考试 · cswork' : 'Skill certification: timed algorithms, SQL and Python exams · cswork',
    description: zh
      ? '四项限时认证考试：算法基础、算法进阶、SQL 和 Python。题目由服务器从你没做过的题里抽取，按测试点计分，通过后获得可在线验证的站内证书。'
      : 'Four timed exams: problem solving (basic and intermediate), SQL and Python. The server draws problems you have not solved, scores by tests passed, and a pass earns a certificate anyone can verify online.',
    path: '/certify',
  });
}

/** /certify: the skill exams for everyone; starting one, results and certificates for the signed-in learner. */
export default async function CertifyPage() {
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="lists-public certify-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="lists-public-header">
        <Link className="lists-public-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '技能认证' : 'certification'}</span>
        </Link>
        <Link href="/learn" prefetch={false}>
          {zh ? '先补基础：入门速成课' : 'Brush up first: beginner courses'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="lists-public-main" id="main-content">
        <div className="certify-intro">
          <p className="certify-kicker">{zh ? 'CSWork 技能认证' : 'CSWork skill certification'}</p>
          <h1>{zh ? '限时开考，凭测试点说话。' : 'A timed exam, scored by the tests you pass.'}</h1>
          <p>
            {zh
              ? '每项认证从你还没做过的题里抽题，计时和评分都在服务器上完成。通过后得到一张可在线验证的证书，可以放到公开主页。'
              : 'Each exam draws problems you have not solved yet, and the server keeps the time and the score. A pass earns a certificate anyone can verify online, which you can list on your public profile.'}
          </p>
        </div>
        <SkillTests
          initial={viewer ? skillOverview(viewer) : null}
          userId={viewer?.id ?? null}
          verified={!!viewer && (viewer.verified || viewer.role === 'teacher')}
          zh={zh}
        />
      </main>
      <footer className="lists-public-footer">
        <Link href="/mock-oa" prefetch={false}>
          {zh ? '模拟 OA' : 'Mock OA'}
        </Link>
        <Link href="/contest" prefetch={false}>
          {zh ? '竞赛' : 'Contests'}
        </Link>
        <Link href="/system-design" prefetch={false}>
          {zh ? '系统设计课' : 'System design course'}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </div>
  );
}
