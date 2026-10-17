import '../library/library.css';
import './interview-platforms.css';
import Link from 'next/link';
import { Fragment, Suspense } from 'react';
import { CHECKED, PLATFORMS, ROWS, type Cell } from '@/lib/content/interview-platforms';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { LibraryPageView } from '../library/page-view';

export async function generateMetadata() {
  const zh = (await requestLocale()) === 'zh';
  return seoMetadata({
    title: zh
      ? `面试平台规则对照：${PLATFORMS.map((p) => p.name).join('、')} · cswork`
      : `Interview platform rules: ${PLATFORMS.map((p) => p.name).join(', ')} · cswork`,
    description: zh
      ? '常见 OA 和技术面平台的规则对照：计分和部分分、交卷前能看到什么、能不能重交、编辑器有没有补全和运行、能查什么资料、怎么监考。每条都附官方帮助页来源，并标明哪些由雇主设置。'
      : 'How common OA and technical interview platforms work: scoring and partial credit, what you see before handing in, resubmitting, editor completion and running, allowed resources and proctoring. Every rule links to the official help page and says which ones the employer sets.',
    path: '/interview-platforms',
  });
}

/** /interview-platforms: rules as rows, platforms as columns, every cell sourced (lib/content/interview-platforms.ts). */
export default async function InterviewPlatformsPage() {
  const zh = (await requestLocale()) === 'zh';
  const L = (zhText: string, en: string) => (zh ? zhText : en);
  const [year, month] = CHECKED.split('-').map(Number);
  const checked = zh
    ? `${year} 年 ${month} 月`
    : new Date(Date.UTC(year, month - 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const cellView = (cell: Cell, platform: string, row: string) => {
    if (cell.k === 'none') return <em>{L('官方未说明', 'Not stated officially')}</em>;
    return (
      <>
        {cell.k === 'employer' && <strong>{L('由雇主设置：', 'Set by the employer: ')}</strong>}
        {zh ? cell.zh : cell.en}
        {cell.src.map((href, i) => {
          const n = cell.src.length > 1 ? ` ${i + 1}` : '';
          return (
            <Fragment key={href}>
              {' '}
              <a href={href} rel="noopener noreferrer" aria-label={L(`${platform}「${row}」来源${n}`, `${platform}, ${row}: source${n}`)}>
                {L('来源', 'Source')}
                {n}
              </a>
            </Fragment>
          );
        })}
      </>
    );
  };
  return (
    <div className="public-library" lang={zh ? 'zh-CN' : 'en'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: L('面试平台规则对照', 'Interview platform rules'), path: '/interview-platforms' },
          ]),
        }}
      />
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / {L('面试平台', 'platforms')}</span>
        </Link>
        <Link href="/?view=mock" prefetch={false}>
          {L('去模拟 OA', 'Mock OA')} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        <article className="public-library-article">
          <header className="public-library-article-header">
            <p className="public-library-eyebrow">INTERVIEW PLATFORMS</p>
            <h1>{L('面试平台规则对照', 'Interview platform rules')}</h1>
            <p>
              {L(
                'OA、电面和终面常用的平台规则各不相同：有的只能交一次，有的取最高分；有的交卷前看不到隐藏用例，有的面试官会把运行关掉。下表按各平台官方帮助页整理，提前知道规则，答题策略也跟着调整。',
                'The platforms used for OAs, phone screens and onsites follow different rules: some take one submission, others keep your best; some hide every scoring test until you hand in, and on some the interviewer can switch running off. The table below comes from each platform’s official help pages, so you can plan around the rules before the day.',
              )}
            </p>
          </header>
          <div className="public-library-prose">
            <h2 id="platform-rules-title">{L('规则对照表', 'The rules side by side')}</h2>
            <p>
              {L(
                '没有标注的是平台写死的规则；「由雇主设置」表示每家公司可以自己调，后面写的是官方说明里的默认做法或可选范围；「官方未说明」表示我们没在官方帮助页里找到。每条后面的「来源」链到对应的官方页面。表格较宽，可以左右滑动。',
                'Unmarked text is a rule the platform fixes. “Set by the employer” means each company can change it, followed by the default or the options the official pages describe. “Not stated officially” means we found nothing in the platform’s help pages. Each “Source” link opens the official page. The table is wide: scroll it sideways.',
              )}
            </p>
            <table className="platform-rules" aria-labelledby="platform-rules-title">
              <thead>
                <tr>
                  <th scope="col">{L('规则', 'Rule')}</th>
                  {PLATFORMS.map((p) => (
                    <th scope="col" key={p.id}>
                      {p.name}
                      <small>
                        <a href={p.languagesSrc} rel="noopener noreferrer" aria-label={L(`${p.name} 官方语言列表`, `${p.name} languages (official)`)}>
                          {L('官方语言列表', 'Languages')}
                        </a>
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const label = zh ? row.zh : row.en;
                  return (
                    <tr key={row.key}>
                      <th scope="row">{label}</th>
                      {PLATFORMS.map((p) => (
                        <td key={p.id}>{cellView(p.cells[row.key], p.name, label)}</td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row">{L('在 cswork 练', 'Practise on cswork')}</th>
                  {PLATFORMS.map((p) => (
                    <td key={p.id}>
                      <ul>
                        {p.practice.map((item) => (
                          <li key={item.href}>
                            <Link href={item.href} prefetch={false}>
                              {zh ? item.zh : item.en}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            <h2>{L('按规则调整做法', 'Adjusting to the rules')}</h2>
            <ul>
              <li>
                {L(
                  '只能交一次（Codility；HackerEarth 说法不一，也按一次准备）：交之前用 Run 跑样例，再加几个自己造的边界用例。样例过了不等于能拿分。',
                  'One submission (Codility; HackerEarth too, since its pages disagree): before submitting, run the example and a few edge cases of your own. Passing the example earns nothing by itself.',
                )}
              </li>
              <li>
                {L(
                  '可以反复交（HackerRank 不限次数，CodeSignal 每题取最高分）：先交一个能过部分用例的暴力解保底，再优化。HackerRank 改完代码要先 Run 再交。',
                  'Repeated submissions (unlimited on HackerRank, best score kept on CodeSignal): bank a brute force that passes some cases first, then optimise. On HackerRank, run changed code before you resubmit.',
                )}
              </li>
              <li>
                {L(
                  '有面试官（CoderPad、Karat）：边写边讲思路。运行可能被关掉，平时也要练习拿一个例子手动走一遍代码。',
                  'With an interviewer (CoderPad, Karat): think aloud as you code. Running may be switched off, so practise tracing an example through your code by hand.',
                )}
              </li>
            </ul>
            <p>
              {L(
                `以上内容核对于 ${checked}。平台会更新规则，雇主也会改设置，一切以邀请邮件和考试说明为准。判题时限和内存的对照见`,
                `Checked in ${checked}. Platforms update their rules and employers change settings, so the invitation email and the test instructions always win. Time and memory limits are compared on the`,
              )}{' '}
              <Link href="/judge-environment" prefetch={false}>
                {L('判题环境说明', 'judge environment page')}
              </Link>
              {L('。', '.')}
            </p>
          </div>
        </article>
      </main>
      <footer className="public-library-footer">
        <Link href="/guide/online-assessment" prefetch={false}>
          {L('在线笔试指南', 'Online assessment guide')}
        </Link>
        <Link href="/judge-environment" prefetch={false}>
          {L('判题环境', 'Judge environment')}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {L('隐私', 'Privacy')}
        </Link>
      </footer>
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </div>
  );
}
