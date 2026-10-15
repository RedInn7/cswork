import type { Metadata } from 'next';
import './offline.css';

export const metadata: Metadata = { title: 'cswork', robots: { index: false } };

/**
 * What public/sw.js shows when a page can't load: no one's data, only how to get back.
 * Both languages, always: the worker keeps one copy for every reader, whatever locale fetched it.
 */
export default function OfflinePage() {
  const dot = <span aria-hidden="true"> · </span>;
  return (
    <main className="offline-page" id="main-content">
      <h1>
        <span lang="en">You’re offline</span>
        {dot}
        <span lang="zh-CN">现在连不上网</span>
      </h1>
      <p lang="en">
        Open the page again once you’re back online. Code drafts you haven’t submitted are kept in this browser on this
        device.
      </p>
      <p lang="zh-CN">网络恢复后重新打开页面就行。编辑器里还没提交的代码草稿保存在这台设备的浏览器里，不会丢。</p>
      <a href="/">
        <span lang="en">Back to cswork</span>
        {dot}
        <span lang="zh-CN">回到 cswork</span>
      </a>
    </main>
  );
}
