'use client';
import { useState } from 'react';
import { Download, FileText, Printer, ScrollText } from 'lucide-react';
import { api } from '@/lib/types';
import type { ProblemSummary } from '@/lib/problems';
import { vaultFiles, vaultMarkdown, type ExportItem, type ExportPage } from '@/lib/notes-export';
import { zip } from '@/lib/zip';
import { Button } from './ui/button';
import '@/app/notes-export.css';

/** Every page of GET oj/notes/export (lib/server/note-export.ts), reporting the notes read so far. */
export async function exportAll(query: Record<string, string>, onCount?: (n: number) => void) {
  const items: ExportItem[] = [];
  let cursor = '';
  do {
    const page = await api<ExportPage>(`oj/notes/export?${new URLSearchParams({ ...query, ...(cursor && { cursor }) })}`);
    items.push(...page.items);
    onCount?.(items.length);
    cursor = page.nextCursor ?? '';
  } while (cursor);
  return items;
}

/** A download made in this browser, as the story bank's Markdown export. */
function save(data: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The notes tab's export: every written note as a .zip Obsidian vault or one .md file, built in this
 * browser, with links to the printable review book and the one-page sheet (/review-sheet).
 */
export function NotesExport({ english, problems }: { english: boolean; problems: readonly ProblemSummary[] }) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [code, setCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  async function run(format: 'zip' | 'md') {
    setBusy(true);
    setStatus({ text: t('正在读取笔记…', 'Reading your notes…') });
    try {
      const items = await exportAll(code ? { code: '1' } : {}, (n) =>
        setStatus({ text: t(`已读取 ${n} 条笔记…`, `${n} notes read…`) }),
      );
      // The server knows LeetCode titles; OA, SQL and course problems take theirs from the bootstrap list.
      const byId = new Map(problems.map((p) => [p.id, p]));
      for (const item of items) {
        const p = item.target.startsWith('problem:') && !item.meta?.title ? byId.get(item.target.slice(8)) : undefined;
        if (p) item.meta = { ...item.meta, title: p.title, titleEn: p.titleEn, difficulty: p.difficulty, topics: p.tags };
      }
      const files = vaultFiles(items, { english, origin: location.origin });
      const name = `cswork-notes-${new Date().toISOString().slice(0, 10)}`;
      if (format === 'zip') save((await zip(files)) as BlobPart, 'application/zip', `${name}.zip`);
      else save(vaultMarkdown(files), 'text/markdown', `${name}.md`);
      setStatus({ text: t(`已导出 ${items.length} 条笔记`, `Exported ${items.length} note${items.length === 1 ? '' : 's'}`) });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="notes-export" aria-labelledby="notes-export-title">
      <h2 id="notes-export-title">{t('导出与打印', 'Export and print')}</h2>
      <p>
        {t(
          '.zip 可以直接当 Obsidian 库打开：每道题一个文件，[[lc-42]] 能跳转。文件都在你的浏览器里生成。',
          'Open the .zip as an Obsidian vault: one file per problem, and [[lc-42]] links resolve. Files are made in this browser.',
        )}
      </p>
      <div className="notes-export-actions">
        <Button variant="outline" disabled={busy} onClick={() => void run('zip')}>
          <Download aria-hidden="true" /> {t('导出 .zip 笔记库', 'Export a .zip vault')}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void run('md')}>
          <FileText aria-hidden="true" /> {t('导出单个 .md', 'Export one .md file')}
        </Button>
        <a href="/review-sheet?view=book&by=stop">
          <Printer aria-hidden="true" /> {t('打印复习册', 'Print a review book')}
        </a>
        <a href="/review-sheet">
          <ScrollText aria-hidden="true" /> {t('面试前一页纸', 'One-page review sheet')}
        </a>
      </div>
      <label className="notes-export-code">
        <input type="checkbox" checked={code} disabled={busy} onChange={(e) => setCode(e.target.checked)} />
        {t('附上每题最近一次 AC 的代码', 'Include each problem’s latest accepted code')}
      </label>
      <p className={status?.error ? 'notes-export-status is-error' : 'notes-export-status'} role="status">
        {status?.text}
      </p>
    </section>
  );
}
