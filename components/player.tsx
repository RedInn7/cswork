'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type VideoJsPlayer from 'video.js/dist/types/player';
import { api } from '@/lib/types';
import {
  initialAsset,
  playbackTarget,
  progressReceiver,
  seekPosition,
} from '@/lib/playback-state';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import 'video.js/dist/video-js.css';
import '@/app/media.css';

// Effects store the Chinese text; it is translated at render so switching
// languages never recreates the player.
const playerErrorsEn: Record<string, string> = {
  '视频尚未发布。你可以先阅读课件。':
    "This video isn't published yet. You can read the lesson first.",
  '视频暂时无法播放，请重新加载。': "The video can't play right now. Please reload.",
};

type Video = { id: string; name: string; url: string; mimeType: string };
type Catalog = {
  lessonId: string;
  attempt: number;
  items: Video[];
  stream: boolean;
};
type ProgressCallback = (position: number, assetId?: string | null) => void;
export function Player({
  lessonId,
  position,
  assetId,
  onProgress,
}: {
  lessonId: string;
  position: number;
  assetId?: string | null;
  onProgress: ProgressCallback;
}) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef({ lessonId, callback: onProgress });
  useLayoutEffect(() => {
    callback.current = { lessonId, callback: onProgress };
  }, [lessonId, onProgress]);
  const positions = useRef(new Map<string, number>()),
    appliedTarget = useRef(new Set<string>());
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [selection, setSelection] = useState<{
      lessonId: string;
      assetId: string | null;
    } | null>(null),
    [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    lessonId,
    attempt: -1,
    assetId: null as string | null,
    waiting: true,
    error: '',
  });
  const target = playbackTarget(
    typeof location === 'undefined' ? '' : location.search,
    lessonId,
  );
  const currentCatalog =
    catalog?.lessonId === lessonId && catalog.attempt === attempt
      ? catalog
      : null;
  const selected = currentCatalog
    ? selection?.lessonId === lessonId &&
      (selection.assetId === null ||
        currentCatalog.items.some((v) => v.id === selection.assetId))
      ? selection.assetId
      : initialAsset(
          currentCatalog.items.map((v) => v.id),
          assetId,
          target,
        )
    : null;
  const isCurrent =
    state.lessonId === lessonId &&
    state.attempt === attempt &&
    state.assetId === selected;
  const waiting = !isCurrent || state.waiting,
    error = isCurrent ? state.error : '';
  useEffect(() => {
    let active = true;
    api<{ items: Video[]; stream: boolean }>(`lessons/${lessonId}/videos`)
      .then((result) => {
        if (!active) return;
        setCatalog({ ...result, lessonId, attempt });
        if (!result.items.length && !result.stream)
          setState({
            lessonId,
            attempt,
            assetId: null,
            waiting: false,
            error: '视频尚未发布。你可以先阅读课件。',
          });
      })
      .catch((e) => {
        if (active)
          setState({
            lessonId,
            attempt,
            assetId: null,
            waiting: false,
            error: (e as Error).message,
          });
      });
    return () => {
      active = false;
    };
  }, [lessonId, attempt]);
  useEffect(() => {
    if (
      !currentCatalog ||
      (!currentCatalog.items.length && !currentCatalog.stream) ||
      !host.current
    )
      return;
    let disposed = false,
      player: VideoJsPlayer | undefined,
      renewal: ReturnType<typeof setTimeout> | undefined;
    let saved = 0,
      refreshing = false,
      ready = false;
    const owner = lessonId,
      currentId = selected,
      capturedCallback = onProgress;
    const positionKey = `${owner}:${currentId || 'stream'}`;
    const targetKey = `${owner}:${target?.assetId || ''}:${target?.position ?? ''}`;
    const seekToQuestion =
      target &&
      (!target.assetId || target.assetId === currentId) &&
      !appliedTarget.current.has(targetKey);
    const initialPosition = seekToQuestion
      ? target.position
      : (positions.current.get(positionKey) ??
        (currentId === (assetId || null) ||
        (!assetId && currentId === currentCatalog.items[0]?.id)
          ? position
          : 0));
    let lastPosition = initialPosition;
    const update = (waiting: boolean, error = '') => {
      if (!disposed)
        setState({
          lessonId: owner,
          attempt,
          assetId: currentId,
          waiting,
          error,
        });
    };
    async function source() {
      const local = currentCatalog!.items.find((v) => v.id === currentId);
      return local
        ? { url: local.url, type: local.mimeType, expiresIn: null }
        : api<{ url: string; type?: string; expiresIn: number | null }>(
            `lessons/${owner}/video`,
          );
    }
    function schedule(seconds: number | null) {
      if (renewal) clearTimeout(renewal);
      if (seconds)
        renewal = setTimeout(
          () => void renewSource(),
          Math.max(30, seconds - 120) * 1000,
        );
    }
    async function renewSource() {
      if (disposed || !player || refreshing) return;
      refreshing = true;
      const paused = player.paused(),
        at = player.currentTime() ?? lastPosition;
      try {
        const next = await source();
        if (disposed || !player) return;
        ready = false;
        player.src({
          src: next.url,
          type: next.type || 'application/x-mpegURL',
        });
        player.one('loadedmetadata', () => {
          if (disposed || !player) return;
          player.currentTime(seekPosition(at, player.duration() || 0));
          ready = true;
          update(false);
          if (!paused) void player.play()?.catch(() => {});
        });
        schedule(next.expiresIn);
      } catch (e) {
        update(false, (e as Error).message);
      } finally {
        refreshing = false;
      }
    }
    const save = () => {
      if (!ready || !player || player.isDisposed() || !player.readyState())
        return;
      lastPosition = player.currentTime() ?? lastPosition;
      positions.current.set(positionKey, lastPosition);
      progressReceiver(
        owner,
        capturedCallback,
        callback.current,
      )(lastPosition, currentId);
    };
    void (async () => {
      try {
        const [next, { default: videojs }] = await Promise.all([
          source(),
          import('video.js'),
        ]);
        if (disposed || !host.current) return;
        const el = document.createElement('video-js');
        el.classList.add('vjs-big-play-centered');
        host.current.appendChild(el);
        player = videojs(el, {
          controls: true,
          fluid: true,
          preload: 'metadata',
          playbackRates: [0.75, 1, 1.25, 1.5, 1.75, 2],
          sources: [
            { src: next.url, type: next.type || 'application/x-mpegURL' },
          ],
        });
        player.one('loadedmetadata', () => {
          if (disposed || !player) return;
          player.currentTime(
            seekPosition(initialPosition, player.duration() || 0),
          );
          ready = true;
          if (seekToQuestion) appliedTarget.current.add(targetKey);
          update(false);
        });
        player.on('timeupdate', () => {
          if (!ready || !player) return;
          lastPosition = player.currentTime() ?? lastPosition;
          positions.current.set(positionKey, lastPosition);
          if (Date.now() - saved > 15000) {
            saved = Date.now();
            save();
          }
        });
        player.on('pause', save);
        player.on('ended', save);
        player.on('error', () =>
          update(false, '视频暂时无法播放，请重新加载。'),
        );
        schedule(next.expiresIn);
      } catch (e) {
        update(false, (e as Error).message);
      }
    })();
    const visibility = () => {
      if (document.visibilityState === 'hidden') save();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', save);
    return () => {
      disposed = true;
      if (renewal) clearTimeout(renewal);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', save);
      if (player && !player.isDisposed()) {
        save();
        ready = false;
        player.dispose();
      }
    };
    // Saved progress changes on every timeupdate; only a catalog/selection change should recreate a player.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, selected, currentCatalog, attempt]);
  return (
    <div>
      {currentCatalog && currentCatalog.items.length > 1 && (
        <fieldset
          className="video-playlist"
          aria-label={t('章节视频列表', 'Lesson videos')}
        >
          {currentCatalog.items.map((video, index) => (
            <button
              type="button"
              key={video.id}
              aria-pressed={selected === video.id}
              onClick={() => setSelection({ lessonId, assetId: video.id })}
            >
              {index + 1}. {video.name.replace(/\.(mp4|webm)$/i, '')}
            </button>
          ))}
        </fieldset>
      )}
      <div ref={host} className="video-host" />
      {waiting && !error && (
        <output className="muted">{t('正在加载视频…', 'Loading video…')}</output>
      )}
      {error && (
        <div className="notice" role="alert">
          {t(error, playerErrorsEn[error] ?? englishMessage(error))}
          <Button
            variant="outline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('重新加载', 'Reload')}
          </Button>
        </div>
      )}
    </div>
  );
}
