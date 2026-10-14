import '../library/library.css';
import './mcp.css';
import { Suspense } from 'react';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { LibraryPageView } from '../library/page-view';
import { McpView } from './view';

export async function generateMetadata() {
  const zh = (await requestLocale()) === 'zh';
  return seoMetadata({
    title: zh ? '在 Claude Code / Cursor 里练题（MCP）· cswork' : 'Practice from Claude Code and Cursor (MCP) · cswork',
    description: zh
      ? '装上 CSWork 的 MCP 服务器，在 AI 编辑器里读题、跑样例、提交并查看判题结果。'
      : 'Add the CSWork MCP server to read problems, run examples, submit and read verdicts from your AI editor.',
    path: '/mcp',
  });
}

export default async function McpPage() {
  const zh = (await requestLocale()) === 'zh';
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: 'MCP', path: '/mcp' },
          ]),
        }}
      />
      <McpView zh={zh} />
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </>
  );
}
