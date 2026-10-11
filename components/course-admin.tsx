'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Save, Eye, History, RefreshCw } from 'lucide-react';
import { api, ApiError, type Boot, type Lesson, date } from '@/lib/types';
import { readLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
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
  const t = useT();
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
          <h2>{t('课程内容', 'Course content')}</h2>
          <p className="muted">
            {t(
              '先准备草稿，确认后发布给已开通的学员。',
              'Prepare drafts first, then publish them to enrolled students.',
            )}
          </p>
        </div>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
            <RefreshCw size={15} />
            {t('刷新', 'Refresh')}
          </Button>
          <Button onClick={() => setCreateCourse(true)}>
            <Plus size={15} />
            {t('新建课程', 'New course')}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {t(error, englishMessage(error))}{' '}
          <Button variant="ghost" onClick={() => setRevision((n) => n + 1)}>
            {t('重试', 'Retry')}
          </Button>
        </p>
      )}
      {loading && !courses.length ? (
        <output>{t('正在加载课程…', 'Loading courses…')}</output>
      ) : !courses.length ? (
        <div className="form-card">
          <h3>{t('还没有课程', 'No courses yet')}</h3>
          <p>
            {t(
              '创建第一门课程，再添加章节和配套视频。',
              'Create your first course, then add lessons and their videos.',
            )}
          </p>
        </div>
      ) : (
        <div className="lms-course-admin-layout">
          <aside className="form-card lms-course-tree">
            <label htmlFor="course-admin-field-1">
              {t('当前课程', 'Current course')}
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
                    {c.published ? '' : t(' · 未上架', ' · Unlisted')}
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
                    {t('课程名称', 'Course title')}
                    <Input
                      id="course-admin-field-2"
                      name="title"
                      defaultValue={detail.course.title}
                      required
                      maxLength={180}
                    />
                  </label>
                  <label>
                    {t('课程介绍', 'Course description')}
                    <textarea
                      name="summary"
                      defaultValue={detail.course.summary}
                      required
                      rows={3}
                      maxLength={12000}
                    />
                  </label>
                  <label htmlFor="course-admin-field-3">
                    {t('排序', 'Position')}
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
                    {t('在课程目录上架', 'List in course catalog')}
                  </label>
                  <Button variant="outline" type="submit" disabled={busy}>
                    {t('保存课程信息', 'Save course details')}
                  </Button>
                </form>
                <div className="lms-toolbar">
                  <h3>{t('章节', 'Lessons')}</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCreateLesson(true)}
                  >
                    <Plus size={14} />
                    {t('添加', 'Add')}
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
                        {lesson.published
                          ? `v${lesson.version}`
                          : t('未发布', 'Unpublished')}
                      </small>
                    </button>
                  ))}
                </div>
                {!detail.lessons.length && (
                  <p className="muted">
                    {t(
                      '添加第一章开始准备课件。',
                      'Add the first lesson to start preparing course materials.',
                    )}
                  </p>
                )}
              </>
            )}
            {!detail && !error && (
              <output>{t('正在加载章节…', 'Loading lessons…')}</output>
            )}
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
                <h3>
                  {t(
                    '选择一个章节开始编辑',
                    'Select a lesson to start editing',
                  )}
                </h3>
                <p className="muted">
                  {t(
                    '草稿与线上版本分开保存。老师之间的并发修改会在保存时检查。',
                    'Drafts are saved separately from the live version. Concurrent edits by other teachers are checked when you save.',
                  )}
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
            <DialogTitle>
              {createCourse
                ? t('新建课程', 'New course')
                : t('新建章节', 'New lesson')}
            </DialogTitle>
            <DialogDescription>
              {t(
                '创建后保持未发布，准备完成再开放给学员。',
                "It stays unpublished until you're ready to open it to students.",
              )}
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
              {t('名称', 'Title')}
              <Input
                id="course-admin-field-4"
                name="title"
                required
                maxLength={180}
              />
            </label>
            <label htmlFor="course-admin-field-5">
              {t('链接标识', 'URL slug')}
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
                {t(
                  '小写字母、数字和短横线，创建后保持不变。',
                  "Lowercase letters, numbers, and hyphens. Can't be changed after creation.",
                )}
              </small>
            </label>
            <label>
              {t('简介', 'Summary')}
              <textarea
                name="summary"
                rows={3}
                required={createCourse}
                maxLength={12000}
              />
            </label>
            {createLesson && (
              <label htmlFor="course-admin-field-6">
                {t('章节分组', 'Section')}
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
              {t('排序', 'Position')}
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
                {t(error, englishMessage(error))}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy
                ? t('正在创建…', 'Creating…')
                : t('创建草稿', 'Create draft')}
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
  const t = useT();
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
          // readLocale, not t: t as an effect dependency would reload the lesson on a language switch.
          setStatus(
            readLocale() === 'zh'
              ? '此浏览器无法保存本地草稿，请及时保存到服务器。'
              : "This browser can't keep local drafts. Save to the server regularly.",
          );
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
    setStatus(t('有未保存的修改', 'Unsaved changes'));
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ revision: current.revision, value: payload(next) }),
      );
    } catch {
      setError(
        t(
          '本地草稿空间不足，请立即保存到服务器。',
          'Not enough storage for the local draft. Save to the server now.',
        ),
      );
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
    if (!draft) throw new Error(t('章节尚未加载', 'Lesson not loaded yet'));
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
          ? t(
              '这个章节已被其他老师更新。你的内容仍保存在本地，请重新加载后比较并恢复草稿。',
              'Another teacher has updated this lesson. Your changes are still saved locally. Reload, compare, and restore your draft.',
            )
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
              {t(error, englishMessage(error))}
            </p>
            <Button onClick={() => setRetry((n) => n + 1)}>
              {t('重新加载', 'Reload')}
            </Button>
          </>
        ) : (
          <output>{t('正在加载课件草稿…', 'Loading lesson draft…')}</output>
        )}
      </div>
    );
  return (
    <div className="form-card lms-lesson-editor">
      <div className="lms-toolbar">
        <div>
          <span className="tag">
            {data.lesson.published
              ? t(
                  `已发布 v${data.lesson.version}`,
                  `Published v${data.lesson.version}`,
                )
              : t('未发布', 'Unpublished')}
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
                t(
                  '重新加载服务器版本？未保存内容会保留在本地恢复区。',
                  'Reload the server version? Unsaved changes will be kept as a local draft.',
                ),
              )
            )
              setRetry((n) => n + 1);
          }}
        >
          <RefreshCw size={15} />
          {t('重新加载', 'Reload')}
        </Button>
      </div>
      {local && (
        <div className="notice">
          <p>
            {t(
              '这台设备有尚未同步的草稿。',
              'This device has an unsynced draft. ',
            )}
            {local.revision !== draft.revision
              ? t(
                  '服务器版本已变化，请先核对当前内容再恢复。',
                  'The server version has changed. Review the current content before restoring.',
                )
              : t(
                  '可以继续上次的编辑。',
                  'You can pick up where you left off.',
                )}
          </p>
          <div className="form-actions">
            <Button
              variant="outline"
              onClick={() => {
                update(local.value);
                setLocal(null);
              }}
            >
              {t('恢复本地内容', 'Restore local draft')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (
                  window.confirm(
                    t('确定丢弃这份本地草稿？', 'Discard this local draft?'),
                  )
                ) {
                  setLocal(null);
                  try {
                    localStorage.removeItem(key);
                  } catch {}
                }
              }}
            >
              {t('丢弃本地草稿', 'Discard local draft')}
            </Button>
          </div>
        </div>
      )}
      <div className="lms-toolbar">
        <output className="muted">
          {status ||
            (draft.hasChanges
              ? t('服务器草稿尚未发布', 'Server draft not published yet')
              : t('与线上版本一致', 'Matches the live version'))}
        </output>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setPreview((v) => !v)}>
            <Eye size={15} />
            {preview ? t('继续编辑', 'Back to editing') : t('预览', 'Preview')}
          </Button>
          <Button
            variant="outline"
            disabled={busy || uploading || !dirty}
            onClick={() =>
              void action(async () => {
                await saveDraft();
                setStatus(t('草稿已保存', 'Draft saved'));
              })
            }
          >
            <Save size={15} />
            {t('保存草稿', 'Save draft')}
          </Button>
          <Button disabled={busy || uploading} onClick={() => setPublish(true)}>
            {t('发布版本', 'Publish version')}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {t(error, englishMessage(error))}
        </p>
      )}
      {preview ? (
        <LessonMarkdown body={draft.body} />
      ) : (
        <fieldset disabled={busy} className="stack-form lms-fieldset">
          <div className="form-columns">
            <label htmlFor="course-admin-field-8">
              {t('章节名称', 'Lesson title')}
              <Input
                id="course-admin-field-8"
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                maxLength={180}
                required
              />
            </label>
            <label htmlFor="course-admin-field-9">
              {t('分组', 'Section')}
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
              {t('简介', 'Summary')}
              <Input
                id="course-admin-field-10"
                value={draft.summary}
                onChange={(e) => update({ summary: e.target.value })}
                maxLength={1000}
              />
            </label>
            <label htmlFor="course-admin-field-11">
              {t('排序', 'Position')}
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
            {t('课件正文（Markdown）', 'Lesson body (Markdown)')}
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
            <summary>
              {t(
                '已有 Cloudflare Stream 视频',
                'Existing Cloudflare Stream video',
              )}
            </summary>
            <p className="muted">
              {t(
                '已有 Stream 视频可直接填写 UID。选择上传视频后会清除此设置。',
                'For a video already on Stream, enter its UID. Choosing an uploaded video clears this setting.',
              )}
            </p>
            <Input
              aria-label={t(
                'Cloudflare Stream 视频 UID',
                'Cloudflare Stream video UID',
              )}
              value={draft.streamUid || ''}
              onChange={(e) =>
                update({
                  streamUid: e.target.value || null,
                  videoAssetIds: e.target.value ? [] : draft.videoAssetIds,
                })
              }
              pattern="[a-f0-9]{32}"
              placeholder={t('32 位视频 UID', '32-character video UID')}
            />
          </details>
        </fieldset>
      )}
      <section className="lms-version-history">
        <div className="section-title">
          <h3>
            <History size={16} />
            {t('发布历史', 'Publishing history')}
          </h3>
          {!!data.lesson.published && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      '下架后学员将无法访问本章节，已有学习记录会保留。确定下架？',
                      'Students will lose access to this lesson; their existing progress is kept. Unpublish it?',
                    ),
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
              {t('下架章节', 'Unpublish lesson')}
            </Button>
          )}
        </div>
        {!data.versions.length && (
          <p className="muted">
            {t(
              '首次发布后会在这里保留历史版本。',
              'Past versions will be kept here after the first publish.',
            )}
          </p>
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
                    t(
                      '将历史版本复制到当前草稿？确认后可预览，再决定是否发布。',
                      'Copy this version into the current draft? You can preview it before deciding whether to publish.',
                    ),
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
                    setStatus(
                      t(
                        `已将 v${v.version} 恢复为草稿，尚未发布`,
                        `Restored v${v.version} as a draft (not published yet)`,
                      ),
                    );
                  });
              }}
            >
              {t('恢复为草稿', 'Restore as draft')}
            </Button>
          </div>
        ))}
      </section>
      <Dialog open={publish} onOpenChange={(open) => !busy && setPublish(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('发布课程新版本', 'Publish a new version')}
            </DialogTitle>
            <DialogDescription>
              {t(
                '保存当前草稿并发布给学员。重要更新会发送站内通知。',
                'Saves the current draft and publishes it to students. Important updates also send an in-app notification.',
              )}
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
                setStatus(t('新版本已发布', 'New version published'));
                await changed();
              });
            }}
          >
            <label htmlFor="course-admin-field-12">
              {t('新版本号', 'New version number')}
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
              {t('更新标题', 'Release title')}
              <Input
                id="course-admin-field-13"
                name="releaseTitle"
                required
                maxLength={180}
                placeholder={t(
                  '例如：补充并发退款的处理说明',
                  'e.g. Add notes on handling concurrent refunds',
                )}
              />
            </label>
            <label>
              {t('更新说明', 'Release notes')}
              <textarea
                name="releaseSummary"
                required
                maxLength={12000}
                rows={4}
                placeholder={t(
                  '变化是什么？学员需要重新学习哪些部分？',
                  'What changed? Which parts should students revisit?',
                )}
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="important" defaultChecked />
              {t('重要更新，通知学员', 'Important update: notify students')}
            </label>
            {error && (
              <p role="alert" className="error-text">
                {t(error, englishMessage(error))}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? t('正在发布…', 'Publishing…') : t('确认发布', 'Publish')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
