'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Save, Eye, History, RefreshCw } from 'lucide-react';
import { api, ApiError, type Boot, type Lesson, date } from '@/lib/types';
import type {
  LmsCourse,
  LmsLessonDraft,
  LmsLessonEditor,
  LmsLessonPayload,
} from '@/lib/lms-types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { LessonMarkdown, formText } from './lms-shared';
import { MediaPicker } from './media-admin';

type CourseDetail = {
  course: LmsCourse;
  lessons: (Lesson & { revision: number; published: number })[];
};
export function CourseAdmin({
  boot,
  refresh,
}: {
  boot: Boot;
  refresh: () => Promise<void>;
}) {
  const [courses, setCourses] = useState<LmsCourse[]>([]),
    [selected, setSelected] = useState(''),
    [detail, setDetail] = useState<CourseDetail | null>(null),
    [lessonId, setLessonId] = useState('');
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [createCourse, setCreateCourse] = useState(false),
    [createLesson, setCreateLesson] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/react-compiler -- A keyed server fetch invalidates the previous resource; editable content remains in its independent local draft.
    setLoading(true);
    setError('');
    api<LmsCourse[]>('lms/courses')
      .then((items) => {
        if (active) {
          setCourses(items);
          setSelected((id) => id || items[0]?.id || '');
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    if (!selected) {
      // oxlint-disable-next-line react/react-compiler -- A keyed server fetch invalidates the previous resource; editable content remains in its independent local draft.
      setDetail(null);
      return;
    }
    let active = true;
    setDetail(null);
    setError('');
    api<CourseDetail>(`lms/courses/${encodeURIComponent(selected)}`)
      .then((data) => active && setDetail(data))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [selected, revision]);
  async function changed() {
    setRevision((n) => n + 1);
    await refresh();
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
      await changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="lms-admin">
      <div className="lms-toolbar">
        <div>
          <h2>课程内容</h2>
          <p className="muted">先准备草稿，确认后发布给已开通的学员。</p>
        </div>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
            <RefreshCw size={15} />
            刷新
          </Button>
          <Button onClick={() => setCreateCourse(true)}>
            <Plus size={15} />
            新建课程
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}{' '}
          <Button variant="ghost" onClick={() => setRevision((n) => n + 1)}>
            重试
          </Button>
        </p>
      )}
      {loading && !courses.length ? (
        <output>正在加载课程…</output>
      ) : !courses.length ? (
        <div className="form-card">
          <h3>还没有课程</h3>
          <p>创建第一门课程，再添加章节和配套视频。</p>
        </div>
      ) : (
        <div className="lms-course-admin-layout">
          <aside className="form-card lms-course-tree">
            <label htmlFor="course-admin-field-1">
              当前课程
              <NativeSelect
                id="course-admin-field-1"
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setLessonId('');
                }}
              >
                {courses.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.title}
                    {c.published ? '' : ' · 未上架'}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            {detail && (
              <>
                <form
                  key={detail.course.id + ':' + detail.course.revision}
                  className="stack-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    void action(async () => {
                      await api(`lms/courses/${selected}`, {
                        expectedRevision: detail.course.revision,
                        title: fd.get('title'),
                        summary: fd.get('summary'),
                        position: Number(fd.get('position')),
                        published: fd.get('published') === 'on',
                      });
                    });
                  }}
                >
                  <label htmlFor="course-admin-field-2">
                    课程名称
                    <Input
                      id="course-admin-field-2"
                      name="title"
                      defaultValue={detail.course.title}
                      required
                      maxLength={180}
                    />
                  </label>
                  <label>
                    课程介绍
                    <textarea
                      name="summary"
                      defaultValue={detail.course.summary}
                      required
                      rows={3}
                      maxLength={12000}
                    />
                  </label>
                  <label htmlFor="course-admin-field-3">
                    排序
                    <Input
                      id="course-admin-field-3"
                      name="position"
                      type="number"
                      min="0"
                      defaultValue={detail.course.position}
                      required
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      name="published"
                      type="checkbox"
                      defaultChecked={detail.course.published}
                    />
                    在课程目录上架
                  </label>
                  <Button variant="outline" type="submit" disabled={busy}>
                    保存课程信息
                  </Button>
                </form>
                <div className="lms-toolbar">
                  <h3>章节</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCreateLesson(true)}
                  >
                    <Plus size={14} />
                    添加
                  </Button>
                </div>
                <div className="lms-lesson-tree">
                  {detail.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      className={lessonId === lesson.id ? 'current' : ''}
                      onClick={() => setLessonId(lesson.id)}
                    >
                      <span>
                        {lesson.position}. {lesson.title}
                      </span>
                      <small>
                        {lesson.published ? `v${lesson.version}` : '未发布'}
                      </small>
                    </button>
                  ))}
                </div>
                {!detail.lessons.length && (
                  <p className="muted">添加第一章开始准备课件。</p>
                )}
              </>
            )}
            {!detail && !error && <output>正在加载章节…</output>}
          </aside>
          <section>
            {lessonId ? (
              <LessonEditor
                key={lessonId}
                id={lessonId}
                userId={boot.person!.id}
                changed={changed}
              />
            ) : (
              <div className="form-card">
                <h3>选择一个章节开始编辑</h3>
                <p className="muted">
                  草稿与线上版本分开保存。老师之间的并发修改会在保存时检查。
                </p>
              </div>
            )}
          </section>
        </div>
      )}
      <Dialog
        open={createCourse || createLesson}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setCreateCourse(false);
            setCreateLesson(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createCourse ? '新建课程' : '新建章节'}</DialogTitle>
            <DialogDescription>
              创建后保持未发布，准备完成再开放给学员。
            </DialogDescription>
          </DialogHeader>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const courseMode = createCourse;
              void action(async () => {
                const id = formText(fd, 'id');
                await api(
                  courseMode
                    ? 'lms/courses'
                    : `lms/courses/${selected}/lessons`,
                  {
                    id,
                    title: fd.get('title'),
                    summary: fd.get('summary') || '',
                    ...(!courseMode
                      ? { section: fd.get('section') || '课程内容' }
                      : {}),
                    position: Number(fd.get('position') || 0),
                  },
                );
                if (courseMode) {
                  setSelected(id);
                  setLessonId('');
                } else setLessonId(id);
                setCreateCourse(false);
                setCreateLesson(false);
              });
            }}
          >
            <label htmlFor="course-admin-field-4">
              名称
              <Input
                id="course-admin-field-4"
                name="title"
                required
                maxLength={180}
              />
            </label>
            <label htmlFor="course-admin-field-5">
              链接标识
              <Input
                id="course-admin-field-5"
                name="id"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxLength={80}
                placeholder={
                  createCourse ? 'system-design' : 'system-design-introduction'
                }
              />
              <small className="muted">
                小写字母、数字和短横线，创建后保持不变。
              </small>
            </label>
            <label>
              简介
              <textarea
                name="summary"
                rows={3}
                required={createCourse}
                maxLength={12000}
              />
            </label>
            {createLesson && (
              <label htmlFor="course-admin-field-6">
                章节分组
                <Input
                  id="course-admin-field-6"
                  name="section"
                  required
                  defaultValue="课程内容"
                  maxLength={100}
                />
              </label>
            )}
            <label htmlFor="course-admin-field-7">
              排序
              <Input
                id="course-admin-field-7"
                name="position"
                type="number"
                min="0"
                defaultValue={
                  createLesson
                    ? (detail?.lessons.length || 0) + 1
                    : courses.length + 1
                }
              />
            </label>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? '正在创建…' : '创建草稿'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function payload(draft: LmsLessonDraft): LmsLessonPayload {
  const { title, summary, section, position, body, streamUid, videoAssetIds } =
    draft;
  return { title, summary, section, position, body, streamUid, videoAssetIds };
}
function LessonEditor({
  id,
  userId,
  changed,
}: {
  id: string;
  userId: string;
  changed: () => Promise<void>;
}) {
  const [data, setData] = useState<LmsLessonEditor | null>(null),
    [draft, setDraft] = useState<LmsLessonDraft | null>(null),
    [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [publish, setPublish] = useState(false),
    [retry, setRetry] = useState(0),
    [local, setLocal] = useState<{
      revision: number;
      value: LmsLessonPayload;
    } | null>(null);
  const key = `cswork:course-draft:${userId}:${id}`;
  const [baseline, setBaseline] = useState(''),
    [uploading, setUploading] = useState(false);
  const currentDraft = useRef(draft);
  useLayoutEffect(() => {
    currentDraft.current = draft;
  }, [draft]);
  const dirty = !!draft && JSON.stringify(payload(draft)) !== baseline;
  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/react-compiler -- A keyed server fetch invalidates the previous resource; editable content remains in its independent local draft.
    setError('');
    setData(null);
    setDraft(null);
    api<LmsLessonEditor>(`lms/lessons/${id}`)
      .then((next) => {
        if (!active) return;
        setData(next);
        setDraft(next.draft);
        const original = JSON.stringify(payload(next.draft));
        setBaseline(original);
        try {
          const saved = localStorage.getItem(key);
          const parsed = saved ? JSON.parse(saved) : null;
          if (parsed?.value && JSON.stringify(parsed.value) !== original)
            setLocal(parsed);
          else {
            setLocal(null);
            localStorage.removeItem(key);
          }
        } catch {
          setStatus('此浏览器无法保存本地草稿，请及时保存到服务器。');
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id, retry, key]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function update(patch: Partial<LmsLessonPayload>) {
    const current = currentDraft.current;
    if (!current) return;
    const next = { ...current, ...patch };
    currentDraft.current = next;
    setDraft(next);
    setStatus('有未保存的修改');
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ revision: current.revision, value: payload(next) }),
      );
    } catch {
      setError('本地草稿空间不足，请立即保存到服务器。');
    }
  }
  function accept(next: LmsLessonEditor) {
    setData(next);
    setDraft(next.draft);
    setBaseline(JSON.stringify(payload(next.draft)));
    setLocal(null);
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (JSON.stringify(saved?.value) === JSON.stringify(payload(next.draft)))
        localStorage.removeItem(key);
    } catch {}
  }
  async function saveDraft() {
    if (!draft) throw new Error('章节尚未加载');
    if (!dirty && draft.revision > 0) return data!;
    const next = await api<LmsLessonEditor>(`lms/lessons/${id}/draft`, {
      expectedRevision: draft.revision,
      ...payload(draft),
    });
    accept(next);
    return next;
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? '这个章节已被其他老师更新。你的内容仍保存在本地，请重新加载后比较并恢复草稿。'
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  if (!data || !draft)
    return (
      <div className="form-card">
        {error ? (
          <>
            <p role="alert" className="error-text">
              {error}
            </p>
            <Button onClick={() => setRetry((n) => n + 1)}>重新加载</Button>
          </>
        ) : (
          <output>正在加载课件草稿…</output>
        )}
      </div>
    );
  return (
    <div className="form-card lms-lesson-editor">
      <div className="lms-toolbar">
        <div>
          <span className="tag">
            {data.lesson.published
              ? `已发布 v${data.lesson.version}`
              : '未发布'}
          </span>
          <h2>{data.lesson.title}</h2>
        </div>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (
              !dirty ||
              window.confirm(
                '重新加载服务器版本？未保存内容会保留在本地恢复区。',
              )
            )
              setRetry((n) => n + 1);
          }}
        >
          <RefreshCw size={15} />
          重新加载
        </Button>
      </div>
      {local && (
        <div className="notice">
          <p>
            这台设备有尚未同步的草稿。
            {local.revision !== draft.revision
              ? '服务器版本已变化，请先核对当前内容再恢复。'
              : '可以继续上次的编辑。'}
          </p>
          <div className="form-actions">
            <Button
              variant="outline"
              onClick={() => {
                update(local.value);
                setLocal(null);
              }}
            >
              恢复本地内容
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm('确定丢弃这份本地草稿？')) {
                  setLocal(null);
                  try {
                    localStorage.removeItem(key);
                  } catch {}
                }
              }}
            >
              丢弃本地草稿
            </Button>
          </div>
        </div>
      )}
      <div className="lms-toolbar">
        <output className="muted">
          {status ||
            (draft.hasChanges ? '服务器草稿尚未发布' : '与线上版本一致')}
        </output>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setPreview((v) => !v)}>
            <Eye size={15} />
            {preview ? '继续编辑' : '预览'}
          </Button>
          <Button
            variant="outline"
            disabled={busy || uploading || !dirty}
            onClick={() =>
              void action(async () => {
                await saveDraft();
                setStatus('草稿已保存');
              })
            }
          >
            <Save size={15} />
            保存草稿
          </Button>
          <Button disabled={busy || uploading} onClick={() => setPublish(true)}>
            发布版本
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {preview ? (
        <LessonMarkdown body={draft.body} />
      ) : (
        <fieldset disabled={busy} className="stack-form lms-fieldset">
          <div className="form-columns">
            <label htmlFor="course-admin-field-8">
              章节名称
              <Input
                id="course-admin-field-8"
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                maxLength={180}
                required
              />
            </label>
            <label htmlFor="course-admin-field-9">
              分组
              <Input
                id="course-admin-field-9"
                value={draft.section}
                onChange={(e) => update({ section: e.target.value })}
                maxLength={100}
                required
              />
            </label>
          </div>
          <div className="form-columns">
            <label htmlFor="course-admin-field-10">
              简介
              <Input
                id="course-admin-field-10"
                value={draft.summary}
                onChange={(e) => update({ summary: e.target.value })}
                maxLength={1000}
              />
            </label>
            <label htmlFor="course-admin-field-11">
              排序
              <Input
                id="course-admin-field-11"
                type="number"
                min="0"
                value={draft.position}
                onChange={(e) => update({ position: Number(e.target.value) })}
              />
            </label>
          </div>
          <label>
            课件正文（Markdown）
            <textarea
              className="source-editor"
              rows={18}
              value={draft.body}
              onChange={(e) => update({ body: e.target.value })}
              maxLength={100000}
            />
          </label>
          <MediaPicker
            onBusyChange={setUploading}
            value={draft.videoAssetIds || []}
            onChange={(ids) =>
              update({
                videoAssetIds: ids,
                streamUid: ids.length ? null : draft.streamUid,
              })
            }
          />
          <details>
            <summary>已有 Cloudflare Stream 视频</summary>
            <p className="muted">
              已有 Stream 视频可直接填写 UID。选择上传视频后会清除此设置。
            </p>
            <Input
              aria-label="Cloudflare Stream 视频 UID"
              value={draft.streamUid || ''}
              onChange={(e) =>
                update({
                  streamUid: e.target.value || null,
                  videoAssetIds: e.target.value ? [] : draft.videoAssetIds,
                })
              }
              pattern="[a-f0-9]{32}"
              placeholder="32 位视频 UID"
            />
          </details>
        </fieldset>
      )}
      <section className="lms-version-history">
        <div className="section-title">
          <h3>
            <History size={16} />
            发布历史
          </h3>
          {!!data.lesson.published && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    '下架后学员将无法访问本章节，已有学习记录会保留。确定下架？',
                  )
                )
                  void action(async () => {
                    const next = await api<LmsLessonEditor>(
                      `lms/lessons/${id}/visibility`,
                      {
                        expectedRevision: data.lesson.revision,
                        published: false,
                      },
                    );
                    if (next?.draft) accept(next);
                    else setRetry((n) => n + 1);
                    await changed();
                  });
              }}
            >
              下架章节
            </Button>
          )}
        </div>
        {!data.versions.length && (
          <p className="muted">首次发布后会在这里保留历史版本。</p>
        )}
        {data.versions.map((v) => (
          <div className="service-row" key={v.id}>
            <span>
              v{v.version} · {date(v.createdAt)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    '将历史版本复制到当前草稿？确认后可预览，再决定是否发布。',
                  )
                )
                  void action(async () => {
                    const current = dirty ? await saveDraft() : data;
                    accept(
                      await api<LmsLessonEditor>(`lms/lessons/${id}/restore`, {
                        version: v.version,
                        expectedRevision: current.draft.revision,
                      }),
                    );
                    setStatus(`已将 v${v.version} 恢复为草稿，尚未发布`);
                  });
              }}
            >
              恢复为草稿
            </Button>
          </div>
        ))}
      </section>
      <Dialog open={publish} onOpenChange={(open) => !busy && setPublish(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发布课程新版本</DialogTitle>
            <DialogDescription>
              保存当前草稿并发布给学员。重要更新会发送站内通知。
            </DialogDescription>
          </DialogHeader>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void action(async () => {
                const current = await saveDraft();
                const next = await api<LmsLessonEditor>(
                  `lms/lessons/${id}/publish`,
                  {
                    expectedRevision: current.draft.revision,
                    version: fd.get('version'),
                    releaseTitle: fd.get('releaseTitle'),
                    releaseSummary: fd.get('releaseSummary'),
                    important: fd.get('important') === 'on',
                  },
                );
                accept(next);
                setPublish(false);
                setStatus('新版本已发布');
                await changed();
              });
            }}
          >
            <label htmlFor="course-admin-field-12">
              新版本号
              <Input
                id="course-admin-field-12"
                name="version"
                placeholder="1.0.1"
                pattern="[0-9]+\.[0-9]+\.[0-9]+"
                required
                maxLength={30}
              />
            </label>
            <label htmlFor="course-admin-field-13">
              更新标题
              <Input
                id="course-admin-field-13"
                name="releaseTitle"
                required
                maxLength={180}
                placeholder="例如：补充并发退款的处理说明"
              />
            </label>
            <label>
              更新说明
              <textarea
                name="releaseSummary"
                required
                maxLength={12000}
                rows={4}
                placeholder="变化是什么？学员需要重新学习哪些部分？"
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="important" defaultChecked />
              重要更新，通知学员
            </label>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? '正在发布…' : '确认发布'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
