import type { Metadata } from 'next';
import { requestLocale } from '@/lib/server/locale';
import './offline.css';

export const metadata: Metadata = { title: 'cswork', robots: { index: false } };

/** What public/sw.js shows when a page can't load: no one's data, only how to get back. */
export default async function OfflinePage() {
  const zh = (await requestLocale()) === 'zh';
  const t = (a: string, b: string) => (zh ? a : b);
  return (
    <main className="offline-page" id="main-content">
      <h1>{t('现在连不上网', 'You’re offline')}</h1>
      <p>
        {t(
          '网络恢复后重新打开页面就行。编辑器里还没提交的代码草稿保存在这台设备的浏览器里，不会丢。',
          'Open the page again once you’re back online. Code drafts you haven’t submitted are kept in this browser on this device.',
        )}
      </p>
      <a href="/">{t('回到 cswork', 'Back to cswork')}</a>
    </main>
  );
}
