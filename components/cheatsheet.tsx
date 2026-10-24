'use client';
import { useState } from 'react';
import { Braces, Download, FileText, Printer, ScrollText, Sheet } from 'lucide-react';
import { api } from '@/lib/types';
import { problemTitle, type ProblemSummary } from '@/lib/problems';
import type { PracticeHistoryItem } from '@/lib/practice-review';
import {
  portfolioFiles,
  progressCsv,
  progressRows,
  vaultFiles,
  vaultMarkdown,
  type ExportItem,
  type SolutionItem,
} from '@/lib/notes-export';
import { zip } from '@/lib/zip';
import { Button } from './ui/button';
import '@/app/notes-export.css';

/** Every page of GET oj/notes/export or oj/solutions/export (lib/server/note-export.ts), reporting the items read so far. */
export async function exportAll<T = ExportItem>(
  query: Record<string, string>,
  onCount?: (n: number) => void,
  path = 'oj/notes/export',
) {
  const items: T[] = [];
  let cursor = '';
  do {
    const page = await api<{ items: T[]; nextCursor: string | null }>(
      `${path}?${new URLSearchParams({ ...query, ...(cursor ? { cursor } : {}) })}`,
    );
    items.push(...page.items);
    onCount?.(items.length);
    cursor = page.nextCursor ?? '';
  } while (cursor);
  return items;
}

/** A download made in this browser. */
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
      <output className={status?.error ? 'notes-export-status is-error' : 'notes-export-status'}>{status?.text}</output>
    </section>
  );
}

/**
 * The history tab's export, built in this browser: every accepted problem's latest code per language
 * as a portfolio .zip (a folder and README per problem, an index by topic), and the practice
 * progress (attempts, help, review dates, lists) as CSV or JSON.
 */
export function ProgressExport({
  english,
  problems,
  history,
  marks,
}: {
  english: boolean;
  problems: readonly ProblemSummary[];
  history: readonly PracticeHistoryItem[];
  marks: readonly { target: string; mark: string }[];
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [notes, setNotes] = useState(false);
  const [oa, setOa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const byId = new Map(problems.map((p) => [p.id, p]));
  const stamp = () => new Date().toISOString().slice(0, 10);
  async function portfolio() {
    setBusy(true);
    setStatus({ text: t('正在读取通过的代码…', 'Reading your accepted code…') });
    try {
      const items = await exportAll<SolutionItem>(
        notes ? { notes: '1' } : {},
        (n) => setStatus({ text: t(`已读取 ${n} 道题…`, `${n} problems read…`) }),
        'oj/solutions/export',
      );
      // As in NotesExport: OA, SQL and course problems take their titles from the bootstrap list.
      for (const item of items) {
        const p = item.meta?.title ? undefined : byId.get(item.problemId);
        if (p) item.meta = { ...item.meta, title: p.title, titleEn: p.titleEn, difficulty: p.difficulty, topics: p.tags };
      }
      const files = portfolioFiles(items, { english, origin: location.origin, oa, notes });
      const count = files.filter((f) => f.name.endsWith('/README.md')).length;
      if (!count) {
        setStatus({
          text:
            !oa && items.some((item) => item.problemId.startsWith('oa-'))
              ? t('目前通过的都是 OA 题：勾选「包括 OA 题」后再导出。', 'Only OA problems are accepted so far: tick Include OA problems to export them.')
              : t('还没有可以导出的通过代码。', 'No accepted code to export yet.'),
        });
        return;
      }
      save((await zip(files, true)) as BlobPart, 'application/zip', `cswork-solutions-${stamp()}.zip`);
      setStatus({ text: t(`已导出 ${count} 道题的代码`, `Exported code for ${count} problem${count === 1 ? '' : 's'}`) });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true });
    } finally {
      setBusy(false);
    }
  }
  function progress(format: 'csv' | 'json') {
    const rows = progressRows(history, {
      marks,
      titleOf: (id) => {
        const p = byId.get(id);
        return p && problemTitle(p);
      },
      difficultyOf: (id) => byId.get(id)?.difficulty,
    });
    const name = `cswork-progress-${stamp()}`;
    if (format === 'csv') save(progressCsv(rows), 'text/csv;charset=utf-8', `${name}.csv`);
    else save(JSON.stringify({ exportedAt: new Date().toISOString(), items: rows }, null, 2), 'application/json', `${name}.json`);
    setStatus({ text: t(`已导出 ${rows.length} 道题的进度`, `Exported progress on ${rows.length} problem${rows.length === 1 ? '' : 's'}`) });
  }
  return (
    <section className="notes-export" aria-labelledby="progress-export-title">
      <h2 id="progress-export-title">{t('导出代码与进度', 'Export code and progress')}</h2>
      <p>
        {t(
          '.zip 是一个题解仓库：每道通过的题一个目录，放每种语言最近一次通过的代码和 README，顶层按知识点列表，不含题面。进度表含通过日期、提交次数、提示、用时和下次复习日。文件都在你的浏览器里生成。',
          'The .zip is a solutions repository: a folder per accepted problem with each language’s latest accepted code and a README, indexed by topic, without statements. The progress table has AC dates, attempts, help, solve time and the next review day. Files are made in this browser.',
        )}
      </p>
      <div className="notes-export-actions">
        <Button variant="outline" disabled={busy} onClick={() => void portfolio()}>
          <Download aria-hidden="true" /> {t('导出 AC 代码 .zip', 'Export accepted code (.zip)')}
        </Button>
        <Button variant="outline" disabled={busy || !history.length} onClick={() => progress('csv')}>
          <Sheet aria-hidden="true" /> {t('进度 CSV', 'Progress CSV')}
        </Button>
        <Button variant="outline" disabled={busy || !history.length} onClick={() => progress('json')}>
          <Braces aria-hidden="true" /> {t('进度 JSON', 'Progress JSON')}
        </Button>
      </div>
      <label className="notes-export-code">
        <input type="checkbox" checked={notes} disabled={busy} onChange={(e) => setNotes(e.target.checked)} />
        {t('在每题 README 里附上我的笔记', 'Add my notes to each problem’s README')}
      </label>
      <label className="notes-export-code">
        <input type="checkbox" checked={oa} disabled={busy} onChange={(e) => setOa(e.target.checked)} />
        {t('包括 OA 题（OA 多有保密条款，仅供私用，勿公开）', 'Include OA problems (often under NDA: keep them private, do not publish)')}
      </label>
      <output className={status?.error ? 'notes-export-status is-error' : 'notes-export-status'}>{status?.text}</output>
    </section>
  );
}
