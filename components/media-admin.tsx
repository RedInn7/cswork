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
      setError('请选择 MP4 或 WebM 视频');
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    setMessage(`正在上传 ${file.name}`);
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
            },
            body: file.slice(
              session!.offset,
              session!.offset + session!.chunkSize,
            ),
            signal: controller.signal,
          },
        );
        const result = await r.json();
        if (!r.ok) throw new Error(result.error || '上传暂时中断');
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
      setMessage(`${file.name} 已上传并选中，发布章节后学员可见。`);
      await load(0);
      setPage(0);
    } catch (e) {
      if ((e as Error).name === 'AbortError')
        setMessage('上传已暂停。重新选择同一文件即可继续。');
      else setError((e as Error).message + '。重新选择同一文件可继续上传。');
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
    <section className="media-picker" aria-label="课程视频素材">
      <div className="media-picker-heading">
        <div>
          <h3>章节视频</h3>
          <p>从素材库选择，或上传 MP4 / WebM；支持一章多段视频。</p>
        </div>
        <Button
          variant="outline"
          disabled={busy || value.length >= 20}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={15} />
          上传视频
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
          <progress aria-label="视频上传进度" value={percent} max={100} />
          <span>{percent}%</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => abort.current?.abort()}
          >
            <Pause size={14} />
            暂停
          </Button>
        </div>
      )}
      {message && <output className="muted">{message}</output>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {value.length > 0 && (
        <ol className="media-selection">
          {value.map((id, i) => (
            <li key={id}>
              <span>
                <small>{String(i + 1).padStart(2, '0')}</small>
                {names[id] || '已选择的视频'}
              </span>
              <div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={i === 0 || busy}
                  aria-label={`上移视频 ${i + 1}`}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={i === value.length - 1 || busy}
                  aria-label={`下移视频 ${i + 1}`}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={`移除视频 ${i + 1}`}
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
          aria-label="搜索视频素材"
          placeholder="搜索素材名称"
          value={query}
          disabled={busy}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button variant="outline" type="submit" disabled={busy}>
          <Search size={15} />
          搜索
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
                    {a.duration ? ` · ${Math.ceil(a.duration / 60)} 分钟` : ''}
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
                预览
              </Button>
            </div>
          ))}
        {!data.items.some((a) => a.status === 'ready') && (
          <p className="muted">还没有可用视频。上传后可预览并加入章节。</p>
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
          刷新
        </Button>
        <span />
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !page}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !data.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </Button>
      </div>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>{preview?.name || '视频预览'}</DialogTitle>
            <DialogDescription>
              预览原始视频，确认声音与画面后再发布章节。
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
                setPreviewError('视频无法播放，请检查原文件格式或重新上传。')
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
