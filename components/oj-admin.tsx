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
import { languages, type ProblemStatement } from '@/lib/problems';
import {
  ojImportSchema,
  OJ_MAX_IMPORT_BYTES,
  OJ_MAX_CASE_BYTES,
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
const fields: Record<string, string> = {
  title: '题目名称',
  id: '题目 ID',
  courseId: '所属课程',
  lessonId: '关联章节',
  tags: '知识点标签',
  description: '题目描述',
  input: '输入',
  output: '输出说明',
  expectedOutput: '预期输出',
  timeLimit: '时间限制',
  memoryLimit: '内存限制',
  outputLimit: '输出限制',
  languages: '可用语言',
  hints: '解题提示',
  weight: '测试点权重',
  name: '测试点名称',
  cases: '测试点',
};
function validationMessage(
  result: ReturnType<typeof ojImportSchema.safeParse>,
) {
  if (result.success) return '';
  return result.error.issues
    .slice(0, 4)
    .map((issue) => {
      const name =
        fields[String(issue.path[issue.path.length - 1])] || '题目设置';
      const where =
        issue.path[0] === 'cases' && typeof issue.path[1] === 'number'
          ? `第 ${issue.path[1] + 1} 个测试点 · ${name}`
          : name;
      return `${where}：${/[\u4e00-\u9fa5]/.test(issue.message) ? issue.message : '内容为空或超出允许范围'}`;
    })
    .join('；');
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
      old ? { ...old, problem: { ...old.problem, [key]: value } } : old,
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
        throw new Error('题目文件最多 8 MiB');
      const value: unknown = JSON.parse(await file.text());
      const parsed = ojImportSchema.safeParse(value);
      if (!parsed.success) throw new Error(validationMessage(parsed));
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
      setNotice('题目文件已载入编辑区。检查内容后保存为草稿。');
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? '文件不是有效的 JSON，请使用本平台导出的题目格式'
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
      setError(validationMessage(parsed));
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
      setNotice('草稿已保存，学员仍看到当前已发布版本。');
      await list();
      return next;
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      if (message.includes('已被更新') || message.includes('重新载入'))
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
        `版本 v${next.problem.versions[0].revision} 已发布。新提交使用新版本，历史提交保留原测试数据。`,
      );
      await list();
      await refresh?.();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      if (message.includes('已被更新')) setConflict(true);
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
      setNotice('历史版本已复制为新草稿。检查后发布即可生效。');
      await list();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      if (message.includes('已被更新')) setConflict(true);
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
      if (file.size > OJ_MAX_CASE_BYTES)
        throw new Error('单个测试文件最多 4 MiB');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (text.includes('\0')) throw new Error('请上传 UTF-8 文本文件');
      updateCase(key, text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const spec = payload?.problem,
    point = payload?.cases[selectedCase];
  const currentVersion = record?.versions.find(
    (v) => v.id === record.currentVersionId,
  );
  const canPublish =
    !!record?.draft?.hasChanges && !dirty && !busy && !conflict;
  return (
    <section className="oj-admin" aria-label="教师题库管理">
      <div className="oj-admin-heading">
        <div>
          <span className="oj-admin-eyebrow">PROBLEM STUDIO</span>
          <h2>把一道好题，打磨到每个边界。</h2>
          <p>题面、测试点和运行限制一起发布，每次提交都有可追溯的版本。</p>
        </div>
        <div className="oj-admin-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => guard(() => fileInput.current?.click())}
          >
            <Upload />
            导入题目
          </Button>
          <Button disabled={busy} onClick={() => guard(startNew)}>
            <Plus />
            新建题目
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
          {error}
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
            <strong>你的编辑已保留。</strong>
            <p>
              另一位老师更新了草稿。可先导出当前内容，再重新载入最新版本进行合并。
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => payload && download(payload)}
          >
            <Download />
            导出我的编辑
          </Button>
          <Button
            variant="outline"
            onClick={() => record && guard(() => void select(record.id))}
          >
            重新载入
          </Button>
        </div>
      )}
      <div className="oj-admin-layout">
        <aside className="oj-admin-list">
          <label className="oj-admin-search">
            <Search size={15} />
            <input
              aria-label="搜索题库"
              placeholder="搜索题目或 ID"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <div className="oj-admin-list-count">
            全部题目 <span>{items.length}</span>
          </div>
          {loading && <p className="oj-admin-muted">正在读取题库…</p>}
          {!loading && !items.length && (
            <p className="oj-admin-muted">
              创建第一道题，或导入题目 JSON 文件。
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
                  {item.published ? `已发布 v${item.version}` : '未发布'}
                  {item.draftRevision ? ' · 有编辑草稿' : ''}
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
            ) && <p className="oj-admin-muted">没有匹配的题目。</p>}
        </aside>
        <div className="oj-admin-editor" aria-busy={busy}>
          {!payload || !spec ? (
            <div className="oj-admin-empty">
              <FileCode2 size={32} />
              <h3>准备好下一道练习了吗？</h3>
              <p>从左侧选择题目，或创建一道原创题。</p>
            </div>
          ) : (
            <>
              <header className="oj-admin-editor-heading">
                <div>
                  <h3>{spec.title || '新建题目'}</h3>
                  <p>
                    {record?.published
                      ? `当前发布 v${currentVersion?.revision ?? '—'}`
                      : '尚未发布'}
                    <span>·</span>
                    {dirty
                      ? '有未保存的更改'
                      : record?.draft
                        ? `草稿已保存 · r${record.draft.revision}`
                        : '正在查看已发布内容'}
                  </p>
                </div>
                <div className="oj-admin-actions">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => download(payload)}
                    title="导出完整题目包（含隐藏测试点）"
                  >
                    <Download />
                    <span className="oj-admin-hide-small">导出</span>
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || conflict || (!dirty && !!record?.draft)}
                    onClick={() => void save()}
                  >
                    <Save />
                    {busy ? '处理中…' : '保存草稿'}
                  </Button>
                  <Button
                    disabled={!canPublish}
                    onClick={() => setPublishOpen(true)}
                  >
                    发布版本
                  </Button>
                </div>
              </header>
              <div
                className="oj-admin-tabs"
                role="tablist"
                aria-label="题目编辑视图"
              >
                {[
                  ['statement', '题面'],
                  ['cases', `测试点 ${payload.cases.length}`],
                  ['settings', '运行设置'],
                  ['history', '版本历史'],
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
                        题目名称
                        <Input
                          id="oj-admin-title"
                          value={spec.title}
                          maxLength={180}
                          placeholder="例如：合并观看进度"
                          onChange={(e) => updateSpec('title', e.target.value)}
                        />
                      </label>
                      <label htmlFor="oj-admin-id">
                        题目 ID
                        <Input
                          id="oj-admin-id"
                          value={spec.id}
                          disabled={!!record}
                          maxLength={80}
                          placeholder="例如：watch-intervals"
                          onChange={(e) => updateSpec('id', e.target.value)}
                        />
                        <small>小写字母、数字和连字符；创建后固定。</small>
                      </label>
                    </div>
                    <div className="oj-admin-form-row">
                      <label>
                        所属课程
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
                        关联章节
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
                        难度
                        <select
                          value={spec.difficulty}
                          onChange={(e) =>
                            updateSpec(
                              'difficulty',
                              e.target.value as OjProblemSpec['difficulty'],
                            )
                          }
                        >
                          <option>简单</option>
                          <option>中等</option>
                          <option>困难</option>
                        </select>
                      </label>
                      <label htmlFor="oj-admin-tags">
                        知识点标签
                        <Input
                          id="oj-admin-tags"
                          value={spec.tags.join(', ')}
                          placeholder="数组, 排序"
                          onChange={(e) =>
                            updateSpec(
                              'tags',
                              e.target.value
                                .split(/[,，]/)
                                .map((s) => s.trim()),
                            )
                          }
                        />
                        <small>使用逗号分隔，最多 12 个。</small>
                      </label>
                    </div>
                    <label>
                      题目描述
                      <textarea
                        rows={6}
                        value={spec.description}
                        maxLength={60000}
                        placeholder="描述问题、约束和需要完成的任务。"
                        onChange={(e) =>
                          updateSpec('description', e.target.value)
                        }
                      />
                    </label>
                    <div className="oj-admin-form-row">
                      <label>
                        输入格式
                        <textarea
                          rows={4}
                          value={spec.input}
                          maxLength={12000}
                          onChange={(e) => updateSpec('input', e.target.value)}
                        />
                      </label>
                      <label>
                        输出格式
                        <textarea
                          rows={4}
                          value={spec.output}
                          maxLength={12000}
                          onChange={(e) => updateSpec('output', e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      样例解释
                      <textarea
                        rows={3}
                        value={spec.explanation}
                        maxLength={12000}
                        onChange={(e) =>
                          updateSpec('explanation', e.target.value)
                        }
                      />
                      <small>样例的输入与输出在「测试点」中维护。</small>
                    </label>
                    <label>
                      渐进提示
                      <textarea
                        rows={3}
                        value={spec.hints.join('\n')}
                        onChange={(e) =>
                          updateSpec(
                            'hints',
                            e.target.value ? e.target.value.split('\n') : [],
                          )
                        }
                        placeholder="每行一条提示，逐步引导学员思考。"
                      />
                      <small>学员按需展开；最多 10 条。</small>
                    </label>
                    <fieldset>
                      <legend>英文题面 / English statement</legend>
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
                        提供完整英文题面
                      </label>
                      <p>
                        不启用时，学员切换英文会看到中文回退提示。样例数据和判题设置共用，不随题面语言改变。
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
                          {payload.cases.filter((c) => !c.hidden).length}{' '}
                          个公开样例
                        </strong>
                        <small>
                          {payload.cases.filter((c) => c.hidden).length}{' '}
                          个隐藏测试 · 总权重{' '}
                          {payload.cases.reduce((n, c) => n + c.weight, 0)}
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
                              {c.hidden ? '隐藏测试' : '公开样例'} · 权重{' '}
                              {c.weight}
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
                        添加测试点
                      </Button>
                      <small className="oj-admin-muted">
                        至少 1 个公开样例和 1 个隐藏测试，最多 64 个。
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
                              title="上移测试点"
                              aria-label="上移测试点"
                              disabled={!selectedCase}
                              onClick={() => moveCase(-1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="下移测试点"
                              aria-label="下移测试点"
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
                              title="删除测试点"
                              aria-label="删除测试点"
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
                            名称
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
                            可见性
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
                                公开样例 · 学员可见
                              </option>
                              <option value="hidden">
                                隐藏测试 · 仅老师可见
                              </option>
                            </select>
                          </label>
                          <label
                            className="oj-admin-weight"
                            htmlFor="oj-admin-case-weight"
                          >
                            权重
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
                                {key === 'input' ? '标准输入' : '预期输出'}
                              </label>
                              <span>
                                {new TextEncoder()
                                  .encode(point[key])
                                  .byteLength.toLocaleString()}{' '}
                                bytes
                              </span>
                              <label className="oj-admin-file-button">
                                <Upload size={13} />
                                从文件导入
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
                          隐藏测试的输入、预期输出和程序输出不会展示给学员。公开样例每项最多
                          32 KiB；隐藏测试每项最多 4 MiB。
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
                        <h4>一致的运行环境，可解释的结果。</h4>
                        <p>限制与判定方式会随题目版本保存。</p>
                      </div>
                    </div>
                    <div className="oj-admin-form-row">
                      <label htmlFor="oj-admin-time-limit">
                        CPU 时间上限（秒）
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
                        <small>每个测试点 0.1–10 秒。</small>
                      </label>
                      <label htmlFor="oj-admin-memory-limit">
                        内存上限（MiB）
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
                        <small>每个测试点 16–512 MiB。</small>
                      </label>
                      <label htmlFor="oj-admin-output-limit">
                        输出上限（KiB）
                        <Input
                          id="oj-admin-output-limit"
                          type="number"
                          min={1}
                          max={4096}
                          value={spec.outputLimit}
                          onChange={(e) =>
                            updateSpec('outputLimit', e.target.valueAsNumber)
                          }
                        />
                        <small>每个测试点 1–4096 KiB。</small>
                      </label>
                    </div>
                    <label>
                      答案判定
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
                          按词元比较 · 忽略多余空格与换行
                        </option>
                        <option value="exact">精确比较 · 包含空格与换行</option>
                        <option value="int-set">
                          整数集合 · 顺序不限，禁止重复
                        </option>
                        <option value="int-multiset">
                          整数多重集合 · 顺序不限，保留次数
                        </option>
                        <option value="string-set">
                          字符串集合 · 每行一项，顺序不限
                        </option>
                      </select>
                      <small>
                        {
                          {
                            tokens:
                              '每个词元的内容和顺序必须一致；数字 1 与 1.0 视为不同。',
                            exact: '输出必须与预期文本逐字一致，包括末尾换行。',
                            'int-set':
                              '首行只写元素数量，其后写对应数量的整数；顺序不限，重复整数不通过。',
                            'int-multiset':
                              '首行写元素总数，其后写整数；顺序不限，每个整数的出现次数必须正确。',
                            'string-set':
                              '首行只写元素数量，其后每行一个字符串，末尾必须换行；保留空串和空格，禁止重复。',
                          }[spec.checker]
                        }
                      </small>
                    </label>
                    <div className="oj-admin-language-options">
                      <strong>开放编程语言</strong>
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
                      所有程序通过标准输入与标准输出交互，不开放网络访问。题目文件只包含声明式数据。
                    </p>
                  </div>
                )}
                {tab === 'history' && (
                  <div className="oj-admin-history">
                    <div className="oj-admin-settings-intro">
                      <History size={24} />
                      <div>
                        <h4>发布留下版本，修改从草稿开始。</h4>
                        <p>
                          恢复历史内容会创建编辑草稿，既有提交和测试数据保持完整。
                        </p>
                      </div>
                    </div>
                    {!record?.versions.length && (
                      <p className="oj-admin-muted">
                        首次发布后，版本会出现在这里。
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
                              ? '当前发布版本'
                              : '历史版本'}
                          </strong>
                          <p>
                            {new Date(version.createdAt).toLocaleString(
                              'zh-CN',
                            )}{' '}
                            · {version.caseCount} 个测试点 ·{' '}
                            {version.hiddenCount} 个隐藏测试
                          </p>
                          <small title={version.checksum}>
                            SHA-256 {version.checksum.slice(0, 16)}…
                          </small>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => guard(() => void restore(version.id))}
                        >
                          复制为草稿
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
            <DialogTitle>保留这次编辑？</DialogTitle>
            <DialogDescription>
              当前有尚未保存的修改。继续切换会放弃这些修改；你也可以返回后先保存草稿。
            </DialogDescription>
          </DialogHeader>
          <div className="oj-admin-dialog-actions">
            <Button variant="outline" onClick={() => setPendingAction(null)}>
              继续编辑
            </Button>
            <Button
              onClick={() => {
                const action = pendingAction;
                setPendingAction(null);
                action?.();
              }}
            >
              放弃修改并继续
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发布「{spec?.title}」？</DialogTitle>
            <DialogDescription>
              将创建版本 v{(record?.versions[0]?.revision || 0) + 1}
              。新提交立即使用这份题面和 {payload?.cases.length}{' '}
              个测试点，历史提交继续保留原版本。
            </DialogDescription>
          </DialogHeader>
          <div className="oj-admin-dialog-actions">
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              返回检查
            </Button>
            <Button onClick={() => void publish()}>发布此版本</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
