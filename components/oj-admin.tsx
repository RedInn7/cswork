'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Download,
  FileCode2,
  History,
  LockKeyhole,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, type Boot } from '@/lib/types';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { languages, type ProblemStatement } from '@/lib/problems';
import {
  ojImportSchema,
  OJ_MAX_IMPORT_BYTES,
  OJ_MAX_CASE_BYTES,
  OJ_MAX_EXPECTED_BYTES,
  OJ_MAX_CASES,
  type OjProblemPackage,
  type OjProblemSpec,
  type OjTeacherProblem,
  type OjImportedCase,
} from '@/lib/oj-types';
import '@/app/oj-admin.css';

type ProblemItem = {
  id: string;
  title: string;
  published: number;
  version: number | null;
  draftRevision: number | null;
  updatedAt: number;
};
const fields: Record<string, { zh: string; en: string }> = {
  title: { zh: '题目名称', en: 'Title' },
  id: { zh: '题目 ID', en: 'Problem ID' },
  courseId: { zh: '所属课程', en: 'Course' },
  lessonId: { zh: '关联章节', en: 'Lesson' },
  tags: { zh: '知识点标签', en: 'Tags' },
  description: { zh: '题目描述', en: 'Description' },
  input: { zh: '输入', en: 'Input' },
  output: { zh: '输出说明', en: 'Output' },
  expectedOutput: { zh: '预期输出', en: 'Expected output' },
  timeLimit: { zh: '时间限制', en: 'Time limit' },
  memoryLimit: { zh: '内存限制', en: 'Memory limit' },
  outputLimit: { zh: '输出限制', en: 'Output limit' },
  languages: { zh: '可用语言', en: 'Languages' },
  hints: { zh: '解题提示', en: 'Hints' },
  weight: { zh: '测试点权重', en: 'Test case weight' },
  name: { zh: '测试点名称', en: 'Test case name' },
  cases: { zh: '测试点', en: 'Test cases' },
};
/** English for the Chinese issue messages of ojImportSchema (lib/oj-types.ts). */
const schemaEn: Record<string, string> = {
  反例题必须恰有一个公开空输入测试点:
    'A counterexample problem needs exactly one public test case with empty input',
  至少需要一个公开样例: 'At least one public example is required',
  至少需要一个隐藏测试点: 'At least one hidden test is required',
  '公开样例最多 8 个': 'At most 8 public examples',
  语言不能重复: 'Languages must not repeat',
  测试点名称不能重复: 'Test case names must be unique',
  语义判题器必须绑定对应题号:
    'A semantic checker must be bound to its problem ID',
  语义判题输入或预期答案不合法:
    'Invalid input or expected output for the semantic checker',
  '整数行集合格式无效：请检查行数、每行长度及重复行':
    'Invalid integer row set: check the row count, row lengths and duplicate rows',
  '多重集合预期输出格式无效：数量与各值的出现次数必须正确':
    'Invalid multiset expected output: the count and each value’s occurrences must be correct',
  '集合预期输出格式无效：请检查首行数量、重复项及行格式':
    'Invalid set expected output: check the count on the first line, duplicates and line format',
  测试数据超过大小限制或含空字符:
    'Test data exceeds the size limit or contains null characters',
  预期输出超过题目输出限制: 'Expected output exceeds the output limit',
  '公开样例输入与输出分别最多 32 KiB，请将大数据设为隐藏测试点':
    'Public example input and output are limited to 32 KiB each; make large data a hidden test',
};
/** English count with a plural "s": plural(2, 'test case') → '2 test cases'. */
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
/** Draft-conflict errors (lib/server/oj-problems.ts); the server sends them in the site language. */
const conflictMessages = [
  '草稿已被更新，请重新载入后保存',
  '草稿已被更新，请重新载入后发布',
];
const isConflict = (message: string) =>
  conflictMessages.some((zh) => englishMessage(zh) === message);
function validationMessage(
  result: ReturnType<typeof ojImportSchema.safeParse>,
  t: (zh: string, en: string) => string,
) {
  if (result.success) return '';
  return result.error.issues
    .slice(0, 4)
    .map((issue) => {
      const field = fields[String(issue.path[issue.path.length - 1])];
      const name = field
        ? t(field.zh, field.en)
        : t('题目设置', 'Problem settings');
      const where =
        issue.path[0] === 'cases' && typeof issue.path[1] === 'number'
          ? t(
              `第 ${issue.path[1] + 1} 个测试点 · ${name}`,
              `Test case ${issue.path[1] + 1} · ${name}`,
            )
          : name;
      // zod's own messages are English; the schema's custom ones are Chinese.
      return t(
        `${where}：${/[\u4e00-\u9fa5]/.test(issue.message) ? issue.message : '内容为空或超出允许范围'}`,
        `${where}: ${schemaEn[issue.message] ?? issue.message}`,
      );
    })
    .join(t('；', '; '));
}
function blankPackage(boot: Boot): OjProblemPackage {
  const course = boot.courses[0];
  return {
    schemaVersion: 1,
    problem: {
      id: '',
      courseId: course?.id || 'gomall',
      lessonId: course?.lessons[0]?.id || '',
      title: '',
      difficulty: '简单',
      tags: ['数组'],
      description: '',
      input: '',
      output: '',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 4096,
      checker: 'tokens',
      languages: ['python', 'go', 'java', 'cpp'],
    },
    cases: [
      {
        name: '样例 1',
        input: '',
        expectedOutput: '',
        hidden: false,
        weight: 10,
      },
      {
        name: '边界测试 1',
        input: '',
        expectedOutput: '',
        hidden: true,
        weight: 10,
      },
    ],
  };
}
function download(payload: OjProblemPackage) {
  const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `${payload.problem.id || 'new-problem'}.cswork.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function OjAdmin({
  boot,
  refresh,
}: {
  boot: Boot;
  refresh?: () => Promise<void>;
}) {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<ProblemItem[]>([]);
  const [record, setRecord] = useState<OjTeacherProblem | null>(null);
  const [payload, setPayload] = useState<OjProblemPackage | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<
    'statement' | 'cases' | 'settings' | 'history'
  >('statement');
  const [selectedCase, setSelectedCase] = useState(0);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const sequence = useRef(0),
    fileInput = useRef<HTMLInputElement>(null);

  async function list() {
    const next = await api<ProblemItem[]>('oj/admin/problems');
    setItems(next);
    return next;
  }
  function install(next: OjTeacherProblem) {
    setRecord(next);
    setPayload(next.draft?.payload || next.publishedPayload);
    setDirty(false);
    setConflict(false);
    setSelectedCase(0);
  }
  async function select(id: string) {
    const request = ++sequence.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await api<OjTeacherProblem>(
        `oj/admin/problems/${encodeURIComponent(id)}`,
      );
      if (request === sequence.current) install(next);
    } catch (e) {
      if (request === sequence.current) setError((e as Error).message);
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    const request = ++sequence.current;
    void api<ProblemItem[]>('oj/admin/problems')
      .then(async (next) => {
        if (cancelled) return;
        setItems(next);
        if (next[0]) {
          const detail = await api<OjTeacherProblem>(
            `oj/admin/problems/${encodeURIComponent(next[0].id)}`,
          );
          if (!cancelled && request === sequence.current) install(detail);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);

  function guard(action: () => void) {
    if (dirty) setPendingAction(() => action);
    else action();
  }
  function updateSpec<K extends keyof OjProblemSpec>(
    key: K,
    value: OjProblemSpec[K],
  ) {
    setPayload((old) =>
      old
        ? {
            ...old,
            problem: {
              ...old.problem,
              [key]: value,
              ...(key === 'checker' &&
              typeof value === 'string' &&
              !value.startsWith('semantic-lc-')
                ? { semanticId: undefined }
                : {}),
              ...(key === 'checker' &&
              typeof value === 'string' &&
              !value.startsWith('strings-lc-')
                ? { stringStructureId: undefined }
                : {}),
              ...(key === 'checker' &&
              typeof value === 'string' &&
              !value.startsWith('design-lc-')
                ? { complexDesignId: undefined }
                : {}),
            },
          }
        : old,
    );
    setDirty(true);
    setNotice('');
  }
  function updateCase<K extends keyof OjImportedCase>(
    key: K,
    value: OjImportedCase[K],
  ) {
    setPayload((old) =>
      old
        ? {
            ...old,
            cases: old.cases.map((c, index) =>
              index === selectedCase ? { ...c, [key]: value } : c,
            ),
          }
        : old,
    );
    setDirty(true);
    setNotice('');
  }
  function startNew() {
    sequence.current++;
    setRecord(null);
    setPayload(blankPackage(boot));
    setDirty(true);
    setTab('statement');
    setSelectedCase(0);
    setError('');
    setNotice('');
    setConflict(false);
  }
  async function importFile(file: File) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (file.size > OJ_MAX_IMPORT_BYTES)
        throw new Error(
          t('题目文件最多 128 MiB', 'Problem files are limited to 128 MiB'),
        );
      const value: unknown = JSON.parse(await file.text());
      const parsed = ojImportSchema.safeParse(value);
      if (!parsed.success) throw new Error(validationMessage(parsed, t));
      const existing = items.find((p) => p.id === parsed.data.problem.id);
      const next = existing
        ? await api<OjTeacherProblem>(
            `oj/admin/problems/${encodeURIComponent(existing.id)}`,
          )
        : null;
      sequence.current++;
      setRecord(next);
      setPayload(parsed.data);
      setDirty(true);
      setSelectedCase(0);
      setConflict(false);
      setTab('statement');
      setNotice(
        t(
          '题目文件已载入编辑区。检查内容后保存为草稿。',
          'Problem file loaded into the editor. Review it, then save it as a draft.',
        ),
      );
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? t(
              '文件不是有效的 JSON，请使用本平台导出的题目格式',
              'This file is not valid JSON. Use the problem format exported from this site.',
            )
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(): Promise<OjTeacherProblem | null> {
    if (!payload) return null;
    const parsed = ojImportSchema.safeParse(payload);
    if (!parsed.success) {
      setError(validationMessage(parsed, t));
      return null;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await api<OjTeacherProblem>('oj/admin/problems/save', {
        payload: parsed.data,
        expectedRevision: record?.draft?.revision ?? null,
      });
      install(next);
      setNotice(
        t(
          '草稿已保存，学员仍看到当前已发布版本。',
          'Draft saved. Students still see the current published version.',
        ),
      );
      await list();
      return next;
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      if (
        message.includes('已被更新') ||
        message.includes('重新载入') ||
        isConflict(message)
      )
        setConflict(true);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!record?.draft || dirty) return;
    setBusy(true);
    setError('');
    setPublishOpen(false);
    try {
      const next = await api<{ versionId: string; problem: OjTeacherProblem }>(
        `oj/admin/problems/${encodeURIComponent(record.id)}/publish`,
        { expectedRevision: record.draft.revision },
      );
      install(next.problem);
      setNotice(
        t(
          `版本 v${next.problem.versions[0].revision} 已发布。新提交使用新版本，历史提交保留原测试数据。`,
          `Version v${next.problem.versions[0].revision} published. New submissions use it; past submissions keep their original test data.`,
        ),
      );
      await list();
      await refresh?.();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      if (message.includes('已被更新') || isConflict(message))
        setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  async function restore(versionId: string) {
    if (!record) return;
    setBusy(true);
    setError('');
    try {
      const next = await api<OjTeacherProblem>(
        `oj/admin/problems/${encodeURIComponent(record.id)}/restore`,
        { versionId, expectedRevision: record.draft?.revision ?? null },
      );
      install(next);
      setTab('statement');
      setNotice(
        t(
          '历史版本已复制为新草稿。检查后发布即可生效。',
          'Past version copied to a new draft. Review it, then publish to make it live.',
        ),
      );
      await list();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      if (message.includes('已被更新') || isConflict(message))
        setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  function addCase() {
    if (!payload || payload.cases.length >= OJ_MAX_CASES) return;
    let number = payload.cases.length + 1;
    while (payload.cases.some((c) => c.name === `测试点 ${number}`)) number++;
    setSelectedCase(payload.cases.length);
    setPayload({
      ...payload,
      cases: [
        ...payload.cases,
        {
          name: `测试点 ${number}`,
          input: '',
          expectedOutput: '',
          hidden: true,
          weight: 10,
        },
      ],
    });
    setDirty(true);
  }
  function moveCase(offset: number) {
    if (!payload) return;
    const target = selectedCase + offset;
    if (target < 0 || target >= payload.cases.length) return;
    const next = [...payload.cases];
    [next[selectedCase], next[target]] = [next[target], next[selectedCase]];
    setPayload({ ...payload, cases: next });
    setSelectedCase(target);
    setDirty(true);
  }
  async function importCase(file: File, key: 'input' | 'expectedOutput') {
    setBusy(true);
    setError('');
    try {
      if (
        file.size >
        (key === 'input' ? OJ_MAX_CASE_BYTES : OJ_MAX_EXPECTED_BYTES)
      )
        throw new Error(
          key === 'input'
            ? t(
                '单个隐藏输入文件最多 32 MiB（公开样例最多 32 KiB）',
                'Hidden input files are limited to 32 MiB each (public examples: 32 KiB)',
              )
            : t(
                '单个答案文件最多 64 MiB',
                'Answer files are limited to 64 MiB each',
              ),
        );
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (text.includes('\0'))
        throw new Error(
          t('请上传 UTF-8 文本文件', 'Please upload a UTF-8 text file'),
        );
      updateCase(key, text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const spec = payload?.problem,
    point = payload?.cases[selectedCase];
  const cases: OjImportedCase[] = payload?.cases ?? [],
    hiddenCount = cases.filter((c) => c.hidden).length,
    sampleCount = cases.length - hiddenCount,
    totalWeight = cases.reduce((n, c) => n + c.weight, 0);
  const currentVersion = record?.versions.find(
    (v) => v.id === record.currentVersionId,
  );
  const canPublish =
    !!record?.draft?.hasChanges && !dirty && !busy && !conflict;
  return (
    <section
      className="oj-admin"
      aria-label={t('教师题库管理', 'Problem admin')}
    >
      <div className="oj-admin-heading">
        <div>
          <span className="oj-admin-eyebrow">PROBLEM STUDIO</span>
          <h2>
            {t(
              '把一道好题，打磨到每个边界。',
              'Polish every problem down to its last edge case.',
            )}
          </h2>
          <p>
            {t(
              '题面、测试点和运行限制一起发布，每次提交都有可追溯的版本。',
              'Statements, test cases and limits ship together, and every submission maps to a traceable version.',
            )}
          </p>
        </div>
        <div className="oj-admin-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => guard(() => fileInput.current?.click())}
          >
            <Upload />
            {t('导入题目', 'Import problem')}
          </Button>
          <Button disabled={busy} onClick={() => guard(startNew)}>
            <Plus />
            {t('新建题目', 'New problem')}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importFile(file);
          }}
        />
      </div>
      {error && (
        <div className="oj-admin-alert" role="alert">
          {t(error, englishMessage(error))}
        </div>
      )}
      {notice && (
        <output className="oj-admin-notice">
          <Check size={16} />
          {notice}
        </output>
      )}
      {conflict && (
        <div className="oj-admin-conflict">
          <div>
            <strong>{t('你的编辑已保留。', 'Your edits are kept.')}</strong>
            <p>
              {t(
                '另一位老师更新了草稿。可先导出当前内容，再重新载入最新版本进行合并。',
                'Another teacher updated this draft. Export your edits first, then reload the latest version and merge.',
              )}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => payload && download(payload)}
          >
            <Download />
            {t('导出我的编辑', 'Export my edits')}
          </Button>
          <Button
            variant="outline"
            onClick={() => record && guard(() => void select(record.id))}
          >
            {t('重新载入', 'Reload')}
          </Button>
        </div>
      )}
      <div className="oj-admin-layout">
        <aside className="oj-admin-list">
          <label className="oj-admin-search">
            <Search size={15} />
            <input
              aria-label={t('搜索题库', 'Search problems')}
              placeholder={t('搜索题目或 ID', 'Search by title or ID')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <div className="oj-admin-list-count">
            {t('全部题目', 'All problems')} <span>{items.length}</span>
          </div>
          {loading && (
            <p className="oj-admin-muted">
              {t('正在读取题库…', 'Loading problems…')}
            </p>
          )}
          {!loading && !items.length && (
            <p className="oj-admin-muted">
              {t(
                '创建第一道题，或导入题目 JSON 文件。',
                'Create your first problem, or import a problem JSON file.',
              )}
            </p>
          )}
          {items
            .filter((item) =>
              `${item.id} ${item.title}`
                .toLowerCase()
                .includes(filter.toLowerCase()),
            )
            .map((item) => (
              <button
                type="button"
                className={`oj-admin-list-item ${record?.id === item.id ? 'active' : ''}`}
                key={item.id}
                aria-current={record?.id === item.id ? 'true' : undefined}
                disabled={busy}
                onClick={() => guard(() => void select(item.id))}
              >
                <strong>{item.title}</strong>
                <small>{item.id}</small>
                <span>
                  {item.published
                    ? t(`已发布 v${item.version}`, `Published v${item.version}`)
                    : t('未发布', 'Unpublished')}
                  {item.draftRevision
                    ? t(' · 有编辑草稿', ' · Draft pending')
                    : ''}
                  <ChevronRight size={14} />
                </span>
              </button>
            ))}
          {!loading &&
            !!items.length &&
            !items.some((item) =>
              `${item.id} ${item.title}`
                .toLowerCase()
                .includes(filter.toLowerCase()),
            ) && (
              <p className="oj-admin-muted">
                {t('没有匹配的题目。', 'No matching problems.')}
              </p>
            )}
        </aside>
        <div className="oj-admin-editor" aria-busy={busy}>
          {!payload || !spec ? (
            <div className="oj-admin-empty">
              <FileCode2 size={32} />
              <h3>
                {t('准备好下一道练习了吗？', 'Ready for the next problem?')}
              </h3>
              <p>
                {t(
                  '从左侧选择题目，或创建一道原创题。',
                  'Pick a problem on the left, or create a new one.',
                )}
              </p>
            </div>
          ) : (
            <>
              <header className="oj-admin-editor-heading">
                <div>
                  <h3>{spec.title || t('新建题目', 'New problem')}</h3>
                  <p>
                    {record?.published
                      ? t(
                          `当前发布 v${currentVersion?.revision ?? '—'}`,
                          `Live v${currentVersion?.revision ?? '—'}`,
                        )
                      : t('尚未发布', 'Not published yet')}
                    <span>·</span>
                    {dirty
                      ? t('有未保存的更改', 'Unsaved changes')
                      : record?.draft
                        ? t(
                            `草稿已保存 · r${record.draft.revision}`,
                            `Draft saved · r${record.draft.revision}`,
                          )
                        : t(
                            '正在查看已发布内容',
                            'Viewing the published version',
                          )}
                  </p>
                </div>
                <div className="oj-admin-actions">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => download(payload)}
                    title={t(
                      '导出完整题目包（含隐藏测试点）',
                      'Export the full problem package (including hidden tests)',
                    )}
                  >
                    <Download />
                    <span className="oj-admin-hide-small">
                      {t('导出', 'Export')}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || conflict || (!dirty && !!record?.draft)}
                    onClick={() => void save()}
                  >
                    <Save />
                    {busy
                      ? t('处理中…', 'Working…')
                      : t('保存草稿', 'Save draft')}
                  </Button>
                  <Button
                    disabled={!canPublish}
                    onClick={() => setPublishOpen(true)}
                  >
                    {t('发布版本', 'Publish version')}
                  </Button>
                </div>
              </header>
              <div
                className="oj-admin-tabs"
                role="tablist"
                aria-label={t('题目编辑视图', 'Problem editor views')}
              >
                {[
                  ['statement', t('题面', 'Statement')],
                  [
                    'cases',
                    t(
                      `测试点 ${payload.cases.length}`,
                      `Test cases ${payload.cases.length}`,
                    ),
                  ],
                  ['settings', t('运行设置', 'Run settings')],
                  ['history', t('版本历史', 'Version history')],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    id={`oj-admin-tab-${value}`}
                    role="tab"
                    aria-selected={tab === value}
                    aria-controls={`oj-admin-panel-${value}`}
                    onClick={() => setTab(value as typeof tab)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <fieldset
                disabled={busy}
                className="oj-admin-fieldset"
                role="tabpanel"
                id={`oj-admin-panel-${tab}`}
                aria-labelledby={`oj-admin-tab-${tab}`}
              >
                {tab === 'statement' && (
                  <div className="oj-admin-form">
                    <div className="oj-admin-form-row">
                      <label htmlFor="oj-admin-title">
                        {t('题目名称', 'Title')}
                        <Input
                          id="oj-admin-title"
                          value={spec.title}
                          maxLength={180}
                          placeholder={t(
                            '例如：合并观看进度',
                            'e.g. Merge watch progress',
                          )}
                          onChange={(e) => updateSpec('title', e.target.value)}
                        />
                      </label>
                      <label htmlFor="oj-admin-id">
                        {t('题目 ID', 'Problem ID')}
                        <Input
                          id="oj-admin-id"
                          value={spec.id}
                          disabled={!!record}
                          maxLength={80}
                          placeholder={t(
                            '例如：watch-intervals',
                            'e.g. watch-intervals',
                          )}
                          onChange={(e) => updateSpec('id', e.target.value)}
                        />
                        <small>
                          {t(
                            '小写字母、数字和连字符；创建后固定。',
                            'Lowercase letters, digits and hyphens. Fixed once created.',
                          )}
                        </small>
                      </label>
                    </div>
                    <div className="oj-admin-form-row">
                      <label>
                        {t('所属课程', 'Course')}
                        <select
                          value={spec.courseId}
                          disabled={!!record}
                          onChange={(e) => {
                            updateSpec('courseId', e.target.value);
                            updateSpec(
                              'lessonId',
                              boot.courses.find((c) => c.id === e.target.value)
                                ?.lessons[0]?.id || '',
                            );
                          }}
                        >
                          {boot.courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t('关联章节', 'Lesson')}
                        <select
                          value={spec.lessonId}
                          onChange={(e) =>
                            updateSpec('lessonId', e.target.value)
                          }
                        >
                          {boot.courses
                            .find((c) => c.id === spec.courseId)
                            ?.lessons.map((lesson) => (
                              <option key={lesson.id} value={lesson.id}>
                                {lesson.title}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <div className="oj-admin-form-row">
                      <label>
                        {t('难度', 'Difficulty')}
                        <select
                          value={spec.difficulty}
                          onChange={(e) =>
                            updateSpec(
                              'difficulty',
                              e.target.value as OjProblemSpec['difficulty'],
                            )
                          }
                        >
                          {/* value = the stored difficulty; only the label is translated */}
                          <option value="简单">{t('简单', 'Easy')}</option>
                          <option value="中等">{t('中等', 'Medium')}</option>
                          <option value="困难">{t('困难', 'Hard')}</option>
                        </select>
                      </label>
                      <label htmlFor="oj-admin-tags">
                        {t('知识点标签', 'Tags')}
                        <Input
                          id="oj-admin-tags"
                          value={spec.tags.join(', ')}
                          placeholder={t('数组, 排序', 'Array, Sorting')}
                          onChange={(e) =>
                            updateSpec(
                              'tags',
                              e.target.value
                                .split(/[,，]/)
                                .map((s) => s.trim()),
                            )
                          }
                        />
                        <small>
                          {t(
                            '使用逗号分隔，最多 12 个。',
                            'Separate with commas, up to 12.',
                          )}
                        </small>
                      </label>
                    </div>
                    <label>
                      {t('题目描述', 'Description')}
                      <textarea
                        rows={6}
                        value={spec.description}
                        maxLength={60000}
                        placeholder={t(
                          '描述问题、约束和需要完成的任务。',
                          'Describe the problem, its constraints and the task.',
                        )}
                        onChange={(e) =>
                          updateSpec('description', e.target.value)
                        }
                      />
                    </label>
                    <div className="oj-admin-form-row">
                      <label>
                        {t('输入格式', 'Input format')}
                        <textarea
                          rows={4}
                          value={spec.input}
                          maxLength={12000}
                          onChange={(e) => updateSpec('input', e.target.value)}
                        />
                      </label>
                      <label>
                        {t('输出格式', 'Output format')}
                        <textarea
                          rows={4}
                          value={spec.output}
                          maxLength={12000}
                          onChange={(e) => updateSpec('output', e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      {t('样例解释', 'Example explanation')}
                      <textarea
                        rows={3}
                        value={spec.explanation}
                        maxLength={12000}
                        onChange={(e) =>
                          updateSpec('explanation', e.target.value)
                        }
                      />
                      <small>
                        {t(
                          '样例的输入与输出在「测试点」中维护。',
                          'Example input and output are edited under Test cases.',
                        )}
                      </small>
                    </label>
                    <label>
                      {t('渐进提示', 'Hints')}
                      <textarea
                        rows={3}
                        value={spec.hints.join('\n')}
                        onChange={(e) =>
                          updateSpec(
                            'hints',
                            e.target.value ? e.target.value.split('\n') : [],
                          )
                        }
                        placeholder={t(
                          '每行一条提示，逐步引导学员思考。',
                          'One hint per line, guiding students step by step.',
                        )}
                      />
                      <small>
                        {t(
                          '学员按需展开；最多 10 条。',
                          'Students reveal them as needed. Up to 10.',
                        )}
                      </small>
                    </label>
                    <fieldset>
                      <legend>
                        {t('英文题面 / English statement', 'English statement')}
                      </legend>
                      <label>
                        <input
                          type="checkbox"
                          checked={!!spec.translations?.en}
                          onChange={(event) => {
                            updateSpec(
                              'translations',
                              event.target.checked
                                ? {
                                    en: {
                                      title: '',
                                      description: '',
                                      input: '',
                                      output: '',
                                      explanation: '',
                                      hints: [],
                                    },
                                  }
                                : undefined,
                            );
                          }}
                        />
                        {t(
                          '提供完整英文题面',
                          'Provide a full English statement',
                        )}
                      </label>
                      <p>
                        {t(
                          '不启用时，学员切换英文会看到中文回退提示。样例数据和判题设置共用，不随题面语言改变。',
                          'When off, students reading in English see the Chinese statement with a fallback notice. Example data and checker settings are shared and do not change with the statement language.',
                        )}
                      </p>
                      {spec.translations?.en &&
                        (
                          [
                            'title',
                            'description',
                            'input',
                            'output',
                            'explanation',
                            'hints',
                          ] as const
                        ).map((field) => {
                          const labels: Record<keyof ProblemStatement, string> =
                            {
                              title: 'Title',
                              description: 'Description',
                              input: 'Input format',
                              output: 'Output format',
                              explanation: 'Example explanation',
                              hints: 'Hints (one per line)',
                            };
                          const translation = spec.translations!.en!;
                          return (
                            <label
                              key={field}
                              style={{ display: 'grid', gap: 8, marginTop: 16 }}
                            >
                              {labels[field]}
                              <textarea
                                lang="en"
                                rows={
                                  field === 'description'
                                    ? 6
                                    : field === 'title'
                                      ? 1
                                      : 3
                                }
                                maxLength={
                                  field === 'title'
                                    ? 180
                                    : field === 'description'
                                      ? 60000
                                      : field === 'hints'
                                        ? 20009
                                        : 12000
                                }
                                value={
                                  field === 'hints'
                                    ? translation.hints.join('\n')
                                    : translation[field]
                                }
                                onChange={(event) =>
                                  updateSpec('translations', {
                                    en: {
                                      ...translation,
                                      [field]:
                                        field === 'hints'
                                          ? event.target.value
                                            ? event.target.value.split('\n')
                                            : []
                                          : event.target.value,
                                    },
                                  })
                                }
                              />
                            </label>
                          );
                        })}
                    </fieldset>
                  </div>
                )}
                {tab === 'cases' && (
                  <div className="oj-admin-cases">
                    <div className="oj-admin-case-nav">
                      <div className="oj-admin-case-summary">
                        <strong>
                          {t(
                            `${sampleCount} 个公开样例`,
                            plural(sampleCount, 'public example'),
                          )}
                        </strong>
                        <small>
                          {t(
                            `${hiddenCount} 个隐藏测试 · 总权重 ${totalWeight}`,
                            `${plural(hiddenCount, 'hidden test')} · Total weight ${totalWeight}`,
                          )}
                        </small>
                      </div>
                      {payload.cases.map((c, index) => (
                        <button
                          type="button"
                          key={index}
                          className={index === selectedCase ? 'active' : ''}
                          onClick={() => setSelectedCase(index)}
                        >
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <div>
                            {c.name}
                            <small>
                              {c.hidden
                                ? t('隐藏测试', 'Hidden test')
                                : t('公开样例', 'Public example')}{' '}
                              · {t('权重', 'Weight')} {c.weight}
                            </small>
                          </div>
                          {c.hidden && <LockKeyhole size={12} />}
                        </button>
                      ))}
                      <Button
                        variant="outline"
                        onClick={addCase}
                        disabled={payload.cases.length >= OJ_MAX_CASES}
                      >
                        <Plus />
                        {t('添加测试点', 'Add test case')}
                      </Button>
                      <small className="oj-admin-muted">
                        {t(
                          '至少 1 个公开样例和 1 个隐藏测试，最多 64 个。',
                          'At least 1 public example and 1 hidden test, up to 64 in total.',
                        )}
                      </small>
                    </div>
                    {point && (
                      <div className="oj-admin-case-editor">
                        <div className="oj-admin-case-title">
                          <div>
                            <span className="oj-admin-eyebrow">
                              CASE {String(selectedCase + 1).padStart(2, '0')}
                            </span>
                            <h4>{point.name}</h4>
                          </div>
                          <div className="oj-admin-actions">
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t('上移测试点', 'Move test case up')}
                              aria-label={t('上移测试点', 'Move test case up')}
                              disabled={!selectedCase}
                              onClick={() => moveCase(-1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t('下移测试点', 'Move test case down')}
                              aria-label={t(
                                '下移测试点',
                                'Move test case down',
                              )}
                              disabled={
                                selectedCase === payload.cases.length - 1
                              }
                              onClick={() => moveCase(1)}
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              title={t('删除测试点', 'Delete test case')}
                              aria-label={t('删除测试点', 'Delete test case')}
                              disabled={payload.cases.length <= 2}
                              onClick={() => {
                                setPayload({
                                  ...payload,
                                  cases: payload.cases.filter(
                                    (_, i) => i !== selectedCase,
                                  ),
                                });
                                setSelectedCase(Math.max(0, selectedCase - 1));
                                setDirty(true);
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                        <div className="oj-admin-form-row">
                          <label htmlFor="oj-admin-case-name">
                            {t('名称', 'Name')}
                            <Input
                              id="oj-admin-case-name"
                              value={point.name}
                              maxLength={100}
                              onChange={(e) =>
                                updateCase('name', e.target.value)
                              }
                            />
                          </label>
                          <label>
                            {t('可见性', 'Visibility')}
                            <select
                              value={point.hidden ? 'hidden' : 'sample'}
                              onChange={(e) =>
                                updateCase(
                                  'hidden',
                                  e.target.value === 'hidden',
                                )
                              }
                            >
                              <option value="sample">
                                {t(
                                  '公开样例 · 学员可见',
                                  'Public example · Visible to students',
                                )}
                              </option>
                              <option value="hidden">
                                {t(
                                  '隐藏测试 · 仅老师可见',
                                  'Hidden test · Teachers only',
                                )}
                              </option>
                            </select>
                          </label>
                          <label
                            className="oj-admin-weight"
                            htmlFor="oj-admin-case-weight"
                          >
                            {t('权重', 'Weight')}
                            <Input
                              id="oj-admin-case-weight"
                              type="number"
                              min={1}
                              max={100}
                              value={point.weight}
                              onChange={(e) =>
                                updateCase('weight', e.target.valueAsNumber)
                              }
                            />
                          </label>
                        </div>
                        {(['input', 'expectedOutput'] as const).map((key) => (
                          <div
                            className="oj-admin-test-data"
                            key={`${selectedCase}:${key}`}
                          >
                            <div>
                              <label htmlFor={`oj-admin-case-${key}`}>
                                {key === 'input'
                                  ? t('标准输入', 'Standard input')
                                  : t('预期输出', 'Expected output')}
                              </label>
                              <span>
                                {new TextEncoder()
                                  .encode(point[key])
                                  .byteLength.toLocaleString()}{' '}
                                bytes
                              </span>
                              <label className="oj-admin-file-button">
                                <Upload size={13} />
                                {t('从文件导入', 'Import from file')}
                                <input
                                  type="file"
                                  accept=".txt,.in,.out,text/plain"
                                  disabled={busy}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    if (file) void importCase(file, key);
                                  }}
                                />
                              </label>
                            </div>
                            <textarea
                              id={`oj-admin-case-${key}`}
                              value={point[key]}
                              rows={8}
                              spellCheck={false}
                              onChange={(e) => updateCase(key, e.target.value)}
                            />
                          </div>
                        ))}
                        <p className="oj-admin-muted">
                          {t(
                            '隐藏测试的输入、预期输出和程序输出不会展示给学员。公开样例每项最多 32 KiB；隐藏输入最多 32 MiB，答案最多 64 MiB。',
                            'Students never see the input, expected output or program output of hidden tests. Public examples allow up to 32 KiB each; hidden input up to 32 MiB, answers up to 64 MiB.',
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {tab === 'settings' && (
                  <div className="oj-admin-form oj-admin-settings">
                    <div className="oj-admin-settings-intro">
                      <FileCode2 size={24} />
                      <div>
                        <h4>
                          {t(
                            '一致的运行环境，可解释的结果。',
                            'A consistent runtime, explainable results.',
                          )}
                        </h4>
                        <p>
                          {t(
                            '限制与判定方式会随题目版本保存。',
                            'Limits and the checker are saved with each problem version.',
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="oj-admin-form-row">
                      <label htmlFor="oj-admin-time-limit">
                        {t('CPU 时间上限（秒）', 'CPU time limit (seconds)')}
                        <Input
                          id="oj-admin-time-limit"
                          type="number"
                          min={0.1}
                          max={10}
                          step={0.1}
                          value={spec.timeLimit}
                          onChange={(e) =>
                            updateSpec('timeLimit', e.target.valueAsNumber)
                          }
                        />
                        <small>
                          {t(
                            '每个测试点 0.1–10 秒。',
                            '0.1–10 seconds per test case.',
                          )}
                        </small>
                      </label>
                      <label htmlFor="oj-admin-memory-limit">
                        {t('内存上限（MiB）', 'Memory limit (MiB)')}
                        <Input
                          id="oj-admin-memory-limit"
                          type="number"
                          min={16}
                          max={512}
                          value={spec.memoryLimit / 1024}
                          onChange={(e) =>
                            updateSpec(
                              'memoryLimit',
                              Math.round(e.target.valueAsNumber * 1024),
                            )
                          }
                        />
                        <small>
                          {t(
                            '每个测试点 16–512 MiB。',
                            '16–512 MiB per test case.',
                          )}
                        </small>
                      </label>
                      <label htmlFor="oj-admin-output-limit">
                        {t('输出上限（KiB）', 'Output limit (KiB)')}
                        <Input
                          id="oj-admin-output-limit"
                          type="number"
                          min={1}
                          max={65536}
                          value={spec.outputLimit}
                          onChange={(e) =>
                            updateSpec('outputLimit', e.target.valueAsNumber)
                          }
                        />
                        <small>
                          {t(
                            '每个测试点 1–65536 KiB。',
                            '1–65536 KiB per test case.',
                          )}
                        </small>
                      </label>
                    </div>
                    <label>
                      {t('答案判定', 'Checker')}
                      <select
                        value={spec.checker}
                        onChange={(e) =>
                          updateSpec(
                            'checker',
                            e.target.value as OjProblemSpec['checker'],
                          )
                        }
                      >
                        <option value="tokens">
                          {t(
                            '按词元比较 · 忽略多余空格与换行',
                            'Token match · Ignores extra spaces and newlines',
                          )}
                        </option>
                        <option value="exact">
                          {t(
                            '精确比较 · 包含空格与换行',
                            'Exact match · Spaces and newlines count',
                          )}
                        </option>
                        <option value="int-set">
                          {t(
                            '整数集合 · 顺序不限，禁止重复',
                            'Integer set · Any order, no duplicates',
                          )}
                        </option>
                        <option value="int-multiset">
                          {t(
                            '整数多重集合 · 顺序不限，保留次数',
                            'Integer multiset · Any order, counts matter',
                          )}
                        </option>
                        <option value="string-set">
                          {t(
                            '字符串集合 · 每行一项，顺序不限',
                            'String set · One per line, any order',
                          )}
                        </option>
                        <option value="int-row-set">
                          {t(
                            '整数行集合 · 行顺序不限',
                            'Integer row set · Rows in any order',
                          )}
                        </option>
                        <option value="int-bag-row-set">
                          {t(
                            '整数行集合 · 行内外顺序不限，保留行内次数',
                            'Integer row set · Any order within and across rows, counts within a row matter',
                          )}
                        </option>
                        <option value="float">
                          {t(
                            '有限浮点数 · 固定误差范围',
                            'Finite float · Fixed tolerance',
                          )}
                        </option>
                        <option value="float-array">
                          {t(
                            '有序浮点数组 · 固定误差范围',
                            'Ordered float array · Fixed tolerance',
                          )}
                        </option>
                        <option value="int-row-multiset">
                          {t(
                            '整数行多重集合 · 保留重复行次数',
                            'Integer row multiset · Duplicate rows counted',
                          )}
                        </option>
                        {[
                          'semantic-lc-',
                          'strings-lc-',
                          'design-lc-',
                          'fraction-lc-',
                          'oa-',
                        ].some((prefix) => spec.checker.startsWith(prefix)) && (
                          <option value={spec.checker}>
                            {t(
                              '本题专用规则 · 接受多种正确答案',
                              'Problem-specific checker · Accepts multiple correct answers',
                            )}
                          </option>
                        )}
                      </select>
                      <small>
                        {(
                          {
                            tokens: t(
                              '每个词元的内容和顺序必须一致；数字 1 与 1.0 视为不同。',
                              'Every token must match in content and order; 1 and 1.0 are different.',
                            ),
                            exact: t(
                              '输出必须与预期文本逐字一致，包括末尾换行。',
                              'Output must match the expected text exactly, including the trailing newline.',
                            ),
                            'int-set': t(
                              '首行只写元素数量，其后写对应数量的整数；顺序不限，重复整数不通过。',
                              'First line: the element count only, followed by that many integers. Any order; duplicate integers fail.',
                            ),
                            'int-multiset': t(
                              '首行写元素总数，其后写整数；顺序不限，每个整数的出现次数必须正确。',
                              'First line: the total element count, followed by the integers. Any order; each integer must appear the right number of times.',
                            ),
                            'int-bag-row-set': t(
                              '先写行数，每行先写长度再写整数；行内外顺序不限，行内重复次数必须正确，禁止等价重复行。',
                              'Row count first, then each row as its length followed by its integers. Any order within and across rows; counts within a row must be right; no equivalent duplicate rows.',
                            ),
                            'int-row-multiset': t(
                              '先写行数，每行先写长度再写整数；行顺序不限，保留行内顺序和每行出现次数。',
                              'Row count first, then each row as its length followed by its integers. Rows in any order; order within a row and how often each row appears both count.',
                            ),
                            'int-row-set': t(
                              '先写行数，每行先写长度再写整数；行顺序不限，每行内部顺序保留，不得重复行。',
                              'Row count first, then each row as its length followed by its integers. Rows in any order; order within a row counts; no duplicate rows.',
                            ),
                            'string-set': t(
                              '首行只写元素数量，其后每行一个字符串，末尾必须换行；保留空串和空格，禁止重复。',
                              'First line: the element count only, then one string per line, ending with a newline. Empty strings and spaces are kept; no duplicates.',
                            ),
                          } as Record<string, string>
                        )[spec.checker] ||
                          t(
                            '按本题输入和约束验证答案，接受符合要求的不同结果。',
                            'Answers are checked against this problem’s input and constraints; any valid result is accepted.',
                          )}
                      </small>
                    </label>
                    <div className="oj-admin-language-options">
                      <strong>{t('开放编程语言', 'Allowed languages')}</strong>
                      <div>
                        {languages.map((language) => (
                          <label key={language.id}>
                            <input
                              type="checkbox"
                              checked={spec.languages.includes(language.id)}
                              onChange={(e) =>
                                updateSpec(
                                  'languages',
                                  e.target.checked
                                    ? [...spec.languages, language.id]
                                    : spec.languages.filter(
                                        (id) => id !== language.id,
                                      ),
                                )
                              }
                            />
                            {language.name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <p className="oj-admin-muted">
                      {t(
                        '所有程序通过标准输入与标准输出交互，不开放网络访问。题目文件只包含声明式数据。',
                        'All programs talk through standard input and output, with no network access. Problem files contain declarative data only.',
                      )}
                    </p>
                  </div>
                )}
                {tab === 'history' && (
                  <div className="oj-admin-history">
                    <div className="oj-admin-settings-intro">
                      <History size={24} />
                      <div>
                        <h4>
                          {t(
                            '发布留下版本，修改从草稿开始。',
                            'Publishing creates a version; edits start as a draft.',
                          )}
                        </h4>
                        <p>
                          {t(
                            '恢复历史内容会创建编辑草稿，既有提交和测试数据保持完整。',
                            'Restoring a past version creates a draft; existing submissions and test data stay intact.',
                          )}
                        </p>
                      </div>
                    </div>
                    {!record?.versions.length && (
                      <p className="oj-admin-muted">
                        {t(
                          '首次发布后，版本会出现在这里。',
                          'Versions appear here after the first publish.',
                        )}
                      </p>
                    )}
                    {record?.versions.map((version) => (
                      <div className="oj-admin-version" key={version.id}>
                        <span className="oj-admin-version-number">
                          v{version.revision}
                        </span>
                        <div>
                          <strong>
                            {version.id === record.currentVersionId
                              ? t('当前发布版本', 'Live version')
                              : t('历史版本', 'Past version')}
                          </strong>
                          <p>
                            {new Date(version.createdAt).toLocaleString(
                              locale === 'zh' ? 'zh-CN' : 'en-US',
                            )}{' '}
                            ·{' '}
                            {t(
                              `${version.caseCount} 个测试点 · ${version.hiddenCount} 个隐藏测试`,
                              `${plural(version.caseCount, 'test case')} · ${plural(version.hiddenCount, 'hidden test')}`,
                            )}
                          </p>
                          <small title={version.checksum}>
                            SHA-256 {version.checksum.slice(0, 16)}…
                          </small>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => guard(() => void restore(version.id))}
                        >
                          {t('复制为草稿', 'Copy to draft')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
            </>
          )}
        </div>
      </div>
      <Dialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('保留这次编辑？', 'Keep these edits?')}
            </DialogTitle>
            <DialogDescription>
              {t(
                '当前有尚未保存的修改。继续切换会放弃这些修改；你也可以返回后先保存草稿。',
                'You have unsaved changes. Continuing discards them; you can go back and save a draft first.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="oj-admin-dialog-actions">
            <Button variant="outline" onClick={() => setPendingAction(null)}>
              {t('继续编辑', 'Keep editing')}
            </Button>
            <Button
              onClick={() => {
                const action = pendingAction;
                setPendingAction(null);
                action?.();
              }}
            >
              {t('放弃修改并继续', 'Discard and continue')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(
                `发布「${spec?.title ?? ''}」？`,
                `Publish “${spec?.title ?? ''}”?`,
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                `将创建版本 v${(record?.versions[0]?.revision || 0) + 1}。新提交立即使用这份题面和 ${cases.length} 个测试点，历史提交继续保留原版本。`,
                `This creates version v${(record?.versions[0]?.revision || 0) + 1}. New submissions use this statement and its ${plural(cases.length, 'test case')} right away; past submissions keep their original version.`,
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="oj-admin-dialog-actions">
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              {t('返回检查', 'Back to review')}
            </Button>
            <Button onClick={() => void publish()}>
              {t('发布此版本', 'Publish this version')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
