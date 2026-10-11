'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import {
  createDemoTrace,
  isDemoKind,
  type DemoKind,
} from '@/lib/algorithm-demo';
import { useT } from '@/lib/i18n';
import '@/app/algorithm-demo.css';

export function AlgorithmDemo({ kind }: { kind: string }) {
  const t = useT();
  if (!isDemoKind(kind))
    return (
      <p>
        {t(
          '该动画暂不可用，请参考本节的图示与例题。',
          'This animation is unavailable. See the diagrams and examples in this lesson.',
        )}
      </p>
    );
  return <DemoPlayer key={kind} kind={kind} />;
}
function DemoPlayer({ kind }: { kind: DemoKind }) {
  const t = useT();
  const trace = useMemo(() => createDemoTrace(kind), [kind]);
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1200);
  const titleId = useId(),
    captionId = useId();
  const frame = trace.frames[step],
    last = trace.frames.length - 1;
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {
      if (motion.matches) setPlaying(false);
    };
    motion.addEventListener('change', stop);
    return () => motion.removeEventListener('change', stop);
  }, []);
  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setStep((s) => Math.min(s + 1, last)),
      speed,
    );
    return () => window.clearTimeout(timer);
  }, [playing, step, last, speed]);
  const move = (next: number) => {
    setPlaying(false);
    setStep(next);
  };
  return (
    <section className="algorithm-demo" aria-labelledby={titleId}>
      <header className="algorithm-demo-header">
        <span className="algorithm-demo-eyebrow">
          {t('交互演示 · 逐步观察', 'Interactive demo · step by step')}
        </span>
        <h3 id={titleId}>{trace.title}</h3>
        <p>{trace.question}</p>
      </header>
      <div
        className={`algorithm-demo-cells ${trace.columns ? 'algorithm-demo-grid' : ''}`}
        style={
          trace.columns
            ? {
                gridTemplateColumns: `repeat(${trace.columns}, minmax(0, 1fr))`,
              }
            : undefined
        }
        aria-label={t('算法当前状态', 'Current algorithm state')}
      >
        {frame.cells.map((cell, i) => (
          <div
            key={i}
            className={`algorithm-demo-cell ${cell.state ? `is-${cell.state}` : ''}`}
            aria-label={t(
              `${cell.label}：${cell.value}${cell.state === 'active' ? '，当前处理' : cell.state === 'answer' ? '，答案' : ''}`,
              `${cell.label}: ${cell.value}${cell.state === 'active' ? ', current' : cell.state === 'answer' ? ', answer' : ''}`,
            )}
          >
            <span>{cell.value}</span>
            <small>{cell.label}</small>
          </div>
        ))}
      </div>
      <div className="algorithm-demo-legend">
        <span>
          <i className="is-active" />
          {t('当前处理', 'Current')}
        </span>
        <span>
          <i className="is-visited" />
          {t('已发现 / 已计算', 'Discovered / computed')}
        </span>
        <span>
          <i className="is-answer" />
          {t('答案', 'Answer')}
        </span>
      </div>
      {frame.queue && (
        <div className="algorithm-demo-queue">
          <strong>{t('队首 → 队尾', 'Front → back')}</strong>
          <div>
            {frame.queue.length ? (
              frame.queue.map((item, i) => (
                <span key={`${item}:${i}`}>{item}</span>
              ))
            ) : (
              <span>{t('空队列', 'Empty queue')}</span>
            )}
          </div>
        </div>
      )}
      <dl className="algorithm-demo-stats">
        {frame.stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p
        className={`algorithm-demo-caption ${frame.done ? 'is-complete' : ''}`}
        id={captionId}
        aria-live={playing ? 'off' : 'polite'}
        aria-atomic="true"
      >
        {frame.done && <strong>✓ </strong>}
        {frame.caption}
      </p>
      <div
        className="algorithm-demo-controls"
        aria-label={t('演示控制', 'Demo controls')}
      >
        <button
          type="button"
          onClick={() => move(0)}
          disabled={step === 0 && !playing}
        >
          {t('重置', 'Reset')}
        </button>
        <button
          type="button"
          onClick={() => move(step - 1)}
          disabled={step === 0}
        >
          {t('上一步', 'Back')}
        </button>
        <button
          type="button"
          className="algorithm-demo-play"
          aria-pressed={playing}
          onClick={() => {
            if (step === last) setStep(0);
            setPlaying((p) => !p);
          }}
        >
          {playing
            ? t('暂停', 'Pause')
            : step === last
              ? t('重新播放', 'Replay')
              : t('播放', 'Play')}
        </button>
        <button
          type="button"
          onClick={() => move(step + 1)}
          disabled={step === last}
        >
          {t('下一步', 'Next')}
        </button>
        <label>
          {t('速度', 'Speed')}
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            <option value={2200}>{t('慢速', 'Slow')}</option>
            <option value={1200}>{t('正常', 'Normal')}</option>
            <option value={650}>{t('快速', 'Fast')}</option>
          </select>
        </label>
      </div>
      <label className="algorithm-demo-timeline">
        <span>
          {t('步骤', 'Step')} {step + 1} / {trace.frames.length}
        </span>
        <input
          aria-label={t('选择演示步骤', 'Choose a demo step')}
          type="range"
          min={0}
          max={last}
          value={step}
          onChange={(event) => move(Number(event.target.value))}
          aria-valuetext={t(
            `第 ${step + 1} 步，共 ${trace.frames.length} 步`,
            `Step ${step + 1} of ${trace.frames.length}`,
          )}
        />
      </label>
      <p className="algorithm-demo-invariant">
        <strong>{t('始终成立', 'Invariant')}</strong>
        {trace.invariant}
      </p>
    </section>
  );
}
