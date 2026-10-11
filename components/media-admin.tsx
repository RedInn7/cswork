'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload,
  Search,
  Check,
  ArrowUp,
  ArrowDown,
  X,
  Pause,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/types';
import { readLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import '@/app/media.css';

type Asset = {
  id: string;
  name: string;
  size: number;
  status: string;
  duration: number | null;
};
type Page = { items: Asset[]; hasMore: boolean; page: number };
export function MediaPicker({
  value,
  onChange,
  onBusyChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useT();
  const [data, setData] = useState<Page>({
    items: [],
    hasMore: false,
    page: 0,
  });
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(0),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false),
    [percent, setPercent] = useState(0),
    [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Asset | null>(null),
    [previewError, setPreviewError] = useState('');
  const abort = useRef<AbortController | null>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const requestId = useRef(0);
  const load = useCallback(
    async (target = page) => {
      const currentRequest = ++requestId.current;
      try {
        const r = await api<Page>(
          `teacher/media?page=${target}&q=${encodeURIComponent(search)}`,
        );
        if (currentRequest !== requestId.current) return;
        setNames((previous) => ({
          ...previous,
          ...Object.fromEntries(r.items.map((asset) => [asset.id, asset.name])),
        }));
        setData(r);
        setError('');
      } catch (e) {
        if (currentRequest === requestId.current)
          setError((e as Error).message);
      }
    },
    [page, search],
  );
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- The initial material catalog is loaded from the authenticated server API.
    void load(page);
  }, [page, load]);
  useEffect(() => () => abort.current?.abort(), []);
  async function upload(file: File) {
    const mimeType =
      file.type ||
      (file.name.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4');
    if (!['video/mp4', 'video/webm'].includes(mimeType)) {
      setError(t('请选择 MP4 或 WebM 视频', 'Choose an MP4 or WebM video'));
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    setMessage(t(`正在上传 ${file.name}`, `Uploading ${file.name}`));
    setPercent(0);
    const controller = new AbortController();
    abort.current = controller;
    const key = `cswork:media-upload:${file.name}:${file.size}:${file.lastModified}`;
    try {
      let uploadId: string | null = null;
      try {
        uploadId = localStorage.getItem(key);
      } catch {
        /* Upload also works without browser storage. */
      }
      let session: {
        uploadId: string;
        assetId: string;
        offset: number;
        chunkSize: number;
        status?: string;
      } | null = null;
      if (uploadId) {
        try {
          session = await api(`teacher/media/uploads/${uploadId}`);
        } catch {
          try {
            localStorage.removeItem(key);
          } catch {}
        }
      }
      if (!session) {
        session = await api('teacher/media/uploads', {
          name: file.name,
          size: file.size,
          mimeType,
        });
        try {
          localStorage.setItem(key, session!.uploadId);
        } catch {}
      }
      while (session!.offset < file.size) {
        if (controller.signal.aborted)
          throw new DOMException('Paused', 'AbortError');
        const r = await fetch(
          `/api/teacher/media/uploads/${session!.uploadId}/chunk`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Upload-Offset': String(session!.offset),
              // Raw fetch: ask for errors in the site language like api() does.
              'X-Locale': readLocale(),
            },
            body: file.slice(
              session!.offset,
              session!.offset + session!.chunkSize,
            ),
            signal: controller.signal,
          },
        );
        const result = await r.json();
        if (!r.ok)
          throw new Error(
            result.error || t('上传暂时中断', 'Upload interrupted'),
          );
        session!.offset = result.offset;
        setPercent(Math.round((result.offset * 100) / file.size));
      }
      const asset = await api<Asset>(
        `teacher/media/uploads/${session!.uploadId}/complete`,
        {},
      );
      try {
        localStorage.removeItem(key);
      } catch {}
      setNames((previous) => ({ ...previous, [asset.id]: asset.name }));
      onChange([...value.filter((v) => v !== asset.id), asset.id]);
      setMessage(
        t(
          `${file.name} 已上传并选中，发布章节后学员可见。`,
          `${file.name} uploaded and selected. Students can see it once the lesson is published.`,
        ),
      );
      await load(0);
      setPage(0);
    } catch (e) {
      if ((e as Error).name === 'AbortError')
        setMessage(
          t(
            '上传已暂停。重新选择同一文件即可继续。',
            'Upload paused. Select the same file again to resume.',
          ),
        );
      else {
        const reason = (e as Error).message;
        setError(
          t(
            reason + '。重新选择同一文件可继续上传。',
            englishMessage(reason) +
              '. Select the same file again to resume the upload.',
          ),
        );
      }
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      abort.current = null;
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  function move(index: number, step: number) {
    const next = [...value];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
  }
  return (
    <section
      className="media-picker"
      aria-label={t('课程视频素材', 'Course video assets')}
    >
      <div className="media-picker-heading">
        <div>
          <h3>{t('章节视频', 'Lesson videos')}</h3>
          <p>
            {t(
              '从素材库选择，或上传 MP4 / WebM；支持一章多段视频。',
              'Pick from the media library or upload MP4 / WebM. A lesson can have several videos.',
            )}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy || value.length >= 20}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={15} />
          {t('上传视频', 'Upload video')}
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="video/mp4,video/webm,.mp4,.webm"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      {busy && (
        <div className="media-upload-status">
          <progress
            aria-label={t('视频上传进度', 'Video upload progress')}
            value={percent}
            max={100}
          />
          <span>{percent}%</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => abort.current?.abort()}
          >
            <Pause size={14} />
            {t('暂停', 'Pause')}
          </Button>
        </div>
      )}
      {message && <output className="muted">{message}</output>}
      {error && (
        <p role="alert" className="error-text">
          {t(error, englishMessage(error))}
        </p>
      )}
      {value.length > 0 && (
        <ol className="media-selection">
          {value.map((id, i) => (
            <li key={id}>
              <span>
                <small>{String(i + 1).padStart(2, '0')}</small>
                {names[id] || t('已选择的视频', 'Selected video')}
              </span>
              <div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={i === 0 || busy}
                  aria-label={t(`上移视频 ${i + 1}`, `Move video ${i + 1} up`)}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={i === value.length - 1 || busy}
                  aria-label={t(
                    `下移视频 ${i + 1}`,
                    `Move video ${i + 1} down`,
                  )}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={t(`移除视频 ${i + 1}`, `Remove video ${i + 1}`)}
                  onClick={() => onChange(value.filter((v) => v !== id))}
                >
                  <X size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form
        className="media-search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setSearch(query.trim());
          if (query.trim() === search && page === 0) void load(0);
        }}
      >
        <Input
          aria-label={t('搜索视频素材', 'Search video assets')}
          placeholder={t('搜索素材名称', 'Search by asset name')}
          value={query}
          disabled={busy}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button variant="outline" type="submit" disabled={busy}>
          <Search size={15} />
          {t('搜索', 'Search')}
        </Button>
      </form>
      <div className="media-library">
        {data.items
          .filter((a) => a.status === 'ready')
          .map((a) => (
            <div className="lms-media-row" key={a.id}>
              <button
                type="button"
                className={value.includes(a.id) ? 'selected' : ''}
                aria-pressed={value.includes(a.id)}
                disabled={busy || (!value.includes(a.id) && value.length >= 20)}
                onClick={() =>
                  onChange(
                    value.includes(a.id)
                      ? value.filter((v) => v !== a.id)
                      : [...value, a.id],
                  )
                }
              >
                <span className="media-check">
                  {value.includes(a.id) && <Check size={14} />}
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <small>
                    {(a.size / 1048576).toFixed(1)} MB
                    {a.duration
                      ? t(
                          ` · ${Math.ceil(a.duration / 60)} 分钟`,
                          ` · ${Math.ceil(a.duration / 60)} min`,
                        )
                      : ''}
                  </small>
                </span>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreviewError('');
                  setPreview(a);
                }}
              >
                {t('预览', 'Preview')}
              </Button>
            </div>
          ))}
        {!data.items.some((a) => a.status === 'ready') && (
          <p className="muted">
            {t(
              '还没有可用视频。上传后可预览并加入章节。',
              'No videos available yet. Upload one to preview it and add it to the lesson.',
            )}
          </p>
        )}
      </div>
      <div className="media-page">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={14} />
          {t('刷新', 'Refresh')}
        </Button>
        <span />
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !page}
          onClick={() => setPage((p) => p - 1)}
        >
          {t('上一页', 'Previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !data.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('下一页', 'Next')}
        </Button>
      </div>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>
              {preview?.name || t('视频预览', 'Video preview')}
            </DialogTitle>
            <DialogDescription>
              {t(
                '预览原始视频，确认声音与画面后再发布章节。',
                'Preview the original video and check its sound and picture before publishing the lesson.',
              )}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            // oxlint-disable-next-line jsx-a11y/media-has-caption -- Preview the teacher's original upload; no caption track exists until one is provided.
            <video
              key={preview.id}
              controls
              preload="metadata"
              aria-label={preview.name}
              style={{ width: '100%', maxHeight: '60vh' }}
              src={`/api/media/${encodeURIComponent(preview.id)}/play`}
              onError={() =>
                setPreviewError(
                  t(
                    '视频无法播放，请检查原文件格式或重新上传。',
                    "This video can't be played. Check the original file format or upload it again.",
                  ),
                )
              }
            />
          )}
          {previewError && (
            <p role="alert" className="error-text">
              {previewError}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
