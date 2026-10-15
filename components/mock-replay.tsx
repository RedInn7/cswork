'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { formatClock, type MockSession } from '@/lib/mock-oa';
import { verdict, type OJSubmission } from '@/lib/oj-client';
import {
  AWAY_MS,
  PASTE_CHARS,
  REPLAY_BYTES,
  SNAPSHOT_MS,
  activeAt,
  cursor,
  delta,
  emptyTrack,
  focusSummary,
  lastCode,
  loadSession,
  loadTrack,
  saveTrack,
  trackWrite,
  timeSummary,
  trackKey,
  type Track,
} from '@/lib/mock-replay';

/**
 * Records this question of a running mock OA (null session: not recording): the editor every
 * SNAPSHOT_MS it changed, the moment the question was opened, each finished run or submission
 * of the exam window, the stretches the page was hidden or unfocused, and pastes over
 * PASTE_CHARS characters. Returns the callback for a submission's result.
 */
export function useReplayRecorder(session: MockSession | null, problemId: string, code: string) {
  const latest = useRef(code);
  latest.current = code;
  const onResult = useRef<(s: OJSubmission) => void>(() => {});
  const id = session?.startedAt ? session.id : null;
  useEffect(() => {
    if (!session?.startedAt || !session.ids.includes(problemId)) return;
    const start = session.startedAt,
      skew = session.skew,
      end = start + session.minutes * 60_000,
      key = trackKey(session.id, problemId),
      cap = Math.floor(REPLAY_BYTES / session.ids.length);
    let track: Track | null = null,
      last = '',
      dirty = false,
      writing = Promise.resolve();
    const now = () => Math.min(Date.now(), end) - start;
    const flush = () => {
      if (!track || !dirty || track.full) return;
      dirty = false;
      const copy = track;
      // One write at a time, in order; a version over the cap is not kept and recording stops.
      writing = trackWrite(
        writing.then(async () => {
          if ((await saveTrack(key, copy, cap)) !== 'full') return;
          copy.full = true;
          // The version kept (the last under the cap) says so too: for the report's note, and so a remount doesn't record on.
          await saveTrack(key, { ...((await loadTrack(key)) ?? emptyTrack()), full: true }, Infinity);
        }),
      );
    };
    const snap = () => {
      if (!track || track.full) return;
      const next = latest.current;
      if (next !== last) {
        track.frames.push([now(), ...delta(last, next)]);
        last = next;
        dirty = true;
      }
      flush();
    };
    let live = true;
    void loadTrack(key).then((saved) => {
      if (!live) return;
      track = saved ?? emptyTrack();
      last = lastCode(track);
      track.opens.push(now());
      dirty = true;
      snap();
    });
    onResult.current = (s) => {
      if (!track || track.full || s.problem_id !== problemId) return;
      // Submissions carry server time.
      const t = s.created_at - skew - start;
      // Older than the exam (a recovered earlier run), or already recorded.
      if (t < -5000 || track.events.some((e) => e.id === s.id.slice(0, 12))) return;
      track.events.push({ t: Math.max(0, t), mode: s.mode, status: s.status, passed: s.passed, total: s.total, id: s.id.slice(0, 12) });
      dirty = true;
      snap();
    };
    // The focus self-check: hidden or unfocused stretches, and long pastes into the code editor
    // (Monaco's bubble up from inside .cs-editor-host; custom input and notes don't count).
    let left: number | null = null;
    const leave = () => {
      left ??= now();
    };
    const back = () => {
      const at = now();
      if (track && !track.full && left !== null && at - left >= AWAY_MS) {
        track.away.push([left, at]);
        dirty = true;
      }
      left = null;
    };
    const visibility = () => (document.visibilityState === 'hidden' ? (leave(), snap()) : back());
    const paste = (e: ClipboardEvent) => {
      const chars = e.clipboardData?.getData('text').length ?? 0;
      const inEditor = e.target instanceof Element && !!e.target.closest('.cs-editor-host');
      if (!track || track.full || !inEditor || chars <= PASTE_CHARS) return;
      track.pastes.push([now(), chars]);
      dirty = true;
    };
    const timer = setInterval(snap, SNAPSHOT_MS);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', leave);
    window.addEventListener('focus', back);
    document.addEventListener('paste', paste, true);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', leave);
      window.removeEventListener('focus', back);
      document.removeEventListener('paste', paste, true);
      back();
      snap();
      onResult.current = () => {};
    };
    // The session is fixed while it runs: its id (and start) is the identity.
    // oxlint-disable-next-line react/react-compiler -- see above.
  }, [id, problemId]);
  return onResult;
}

const SPEEDS = [1, 4, 16] as const;
type Marker = { t: number; q: number; mode: 'run' | 'judge'; status: string; passed: number; total: number };
const tone = (m: Marker) => (m.status === 'accepted' ? 'ac' : m.mode === 'run' ? 'run' : 'fail');

/**
 * The replay on a finished mock's report: a timeline with each run and submission marked,
 * play / pause at 1×, 4× or 16×, the code as it stood, and where the time went.
 */
export function MockReplay({ session, title }: { session: MockSession; title: (id: string) => string }) {
  const t = useT();
  const [tracks, setTracks] = useState<(Track | null)[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadSession(session.id, session.ids).then((found) => live && setTracks(found));
    return () => {
      live = false;
    };
  }, [session.id, session.ids]);
  const duration = Math.max(0, (session.finishedAt ?? session.startedAt ?? 0) - (session.startedAt ?? 0));
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(4);
  const [pinned, setPinned] = useState<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    const step = 100;
    const timer = setInterval(
      () =>
        setAt((x) => {
          const next = Math.min(duration, x + step * speed);
          if (next >= duration) setPlaying(false);
          return next;
        }),
      step,
    );
    return () => clearInterval(timer);
  }, [playing, speed, duration]);
  const cursors = useMemo(() => tracks?.map((track) => cursor(track?.frames ?? [])) ?? [], [tracks]);
  if (!tracks || !tracks.some((track) => track?.frames.length)) return null;
  const markers: Marker[] = tracks
    .flatMap((track, q) => (track?.events ?? []).map((e) => ({ ...e, q })))
    .filter((m) => m.t <= duration)
    .sort((a, b) => a.t - b.t);
  const live = activeAt(tracks, at);
  const shown = pinned ?? Math.max(0, live);
  const code = cursors[shown]?.(at) ?? '';
  const { perQuestion, pauses } = timeSummary(tracks, duration);
  const focus = focusSummary(tracks, duration);
  const unrecorded = tracks.some((track) => track?.legacy);
  const pos = (ms: number) => `${duration ? (ms / duration) * 100 : 0}%`;
  const label = (m: Marker) =>
    `Q${m.q + 1} · ${m.mode === 'run' ? t('运行', 'Run') : t('提交', 'Submit')} · ${t(...verdict(m.status, m.mode))}${
      m.total ? ` ${m.passed}/${m.total}` : ''
    } · ${formatClock(m.t)}`;
  const seek = (x: number) => {
    setPlaying(false);
    setAt(Math.max(0, Math.min(duration, x)));
  };
  return (
    <section className="mock-section mock-replay" aria-labelledby="mock-replay-title">
      <div className="mock-toolbar">
        <h3 id="mock-replay-title">{t('代码回放', 'Code replay')}</h3>
        <p>
          {t(
            '考试中每 2 秒记一次代码，只存在这个浏览器里，不上传。',
            'The editor was recorded every 2 seconds during the exam. It stays in this browser and is never uploaded.',
          )}
        </p>
      </div>
      <div className="mock-replay-deck">
        <div className="mock-replay-controls">
          <button
            type="button"
            className="mock-replay-play"
            onClick={() => (at >= duration ? (setAt(0), setPlaying(true)) : setPlaying(!playing))}
            aria-label={playing ? t('暂停', 'Pause') : t('播放', 'Play')}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <span className="mock-replay-clock" aria-hidden="true">
            {formatClock(at)} / {formatClock(duration)}
          </span>
          <div className="mock-replay-speeds" role="group" aria-label={t('倍速', 'Speed')}>
            {SPEEDS.map((s) => (
              <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
        </div>
        <div className="mock-replay-track">
          <input
            type="range"
            min={0}
            max={duration}
            step={1000}
            value={at}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label={t('回放进度', 'Replay position')}
            aria-valuetext={`${formatClock(at)} / ${formatClock(duration)}`}
          />
          {/* Away stretches and long pastes: drawn here, told in words under the time split. */}
          {!unrecorded && (
            <ol className="mock-replay-away" aria-hidden="true">
              {focus.away.map(([from, to]) => (
                <li key={from} style={{ left: pos(from), width: `calc(${pos(to - from)} + 2px)` }} />
              ))}
              {focus.pastes.map((p, i) => (
                <li key={`p${i}`} className="mock-replay-paste" style={{ left: pos(p.t) }} title={`Q${p.q + 1} · ${formatClock(p.t)}`} />
              ))}
            </ol>
          )}
          <ol className="mock-replay-marks" aria-label={t('运行和提交', 'Runs and submissions')}>
            {markers.map((m, i) => (
              <li key={i} style={{ left: `${duration ? (m.t / duration) * 100 : 0}%` }}>
                <button type="button" data-tone={tone(m)} title={label(m)} aria-label={label(m)} onClick={() => seek(m.t)} />
              </li>
            ))}
          </ol>
        </div>
        <div className="mock-replay-qs" role="group" aria-label={t('显示哪道题', 'Question shown')}>
          <button type="button" aria-pressed={pinned === null} onClick={() => setPinned(null)}>
            {t('跟随作答', 'Follow along')}
          </button>
          {session.ids.map((id, q) => (
            <button
              key={id}
              type="button"
              aria-pressed={pinned === q}
              data-live={pinned === null && live === q ? true : undefined}
              disabled={!tracks[q]?.frames.length}
              onClick={() => setPinned(q)}
            >
              Q{q + 1}
            </button>
          ))}
        </div>
        <figure className="mock-replay-code">
          <figcaption>
            <strong>Q{shown + 1}</strong> {title(session.ids[shown])}
            {tracks[shown]?.full && <small>{t(' · 录制已达上限，之后的改动没有记下', ' · Recording hit its size cap; later edits were not kept')}</small>}
          </figcaption>
          <pre tabIndex={0} aria-label={t(`Q${shown + 1} 此刻的代码`, `Q${shown + 1} code at this moment`)}>
            <code>{code || t('（还没有写代码）', '(no code yet)')}</code>
          </pre>
        </figure>
      </div>
      <div className="mock-replay-split">
        <h4>{t('时间分布', 'Where the time went')}</h4>
        <ol className="mock-replay-bars">
          {session.ids.map((id, q) => (
            <li key={id}>
              <span className="mock-q">Q{q + 1}</span>
              <span className="mock-replay-name">{title(id)}</span>
              <span className="mock-replay-bar" aria-hidden="true">
                <i style={{ width: `${duration ? (perQuestion[q] / duration) * 100 : 0}%` }} />
              </span>
              <span className="mock-replay-time">{formatClock(perQuestion[q])}</span>
            </li>
          ))}
        </ol>
        {pauses.length ? (
          <ul className="mock-replay-pauses">
            {pauses.map((p, i) => (
              <li key={i}>
                <button type="button" className="mock-ghost" onClick={() => seek(p.from)}>
                  {formatClock(p.from)}–{formatClock(p.to)}
                </button>{' '}
                {t(`Q${p.q + 1} 停了 ${formatClock(p.to - p.from)} 没有操作`, `Q${p.q + 1}: ${formatClock(p.to - p.from)} with no activity`)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mock-footnote">{t('没有超过 3 分钟的停顿。', 'No pause longer than 3 minutes.')}</p>
        )}
        <h4>{t('专注度自检', 'Focus self-check')}</h4>
        {unrecorded ? (
          <p className="mock-replay-focus">
            {t('这场模拟在专注度自检上线前开始，没有记录离开页面和粘贴。', 'This mock began before the focus self-check, so time away and pastes were not recorded.')}
          </p>
        ) : (
          <>
            <p className="mock-replay-focus">
              {t(
                `离开页面 ${focus.away.length} 次，共 ${formatClock(focus.awayMs)}；粘贴 ${focus.pastes.length} 次（超过 ${PASTE_CHARS} 字符）。`,
                `Left the page ${focus.away.length} time${focus.away.length === 1 ? '' : 's'} for ${formatClock(focus.awayMs)} in all; ${focus.pastes.length} paste${focus.pastes.length === 1 ? '' : 's'} of over ${PASTE_CHARS} characters.`,
              )}
            </p>
            <p className="mock-footnote">
              {t(
                '给你自己复盘用：只保存在这个浏览器里，不上传，也不是监考。时间轴上的灰带是离开的时段，竖线是粘贴。',
                'For your own review: kept in this browser only, never uploaded, and not proctoring. Grey bands on the timeline are time away; ticks are pastes.',
              )}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
