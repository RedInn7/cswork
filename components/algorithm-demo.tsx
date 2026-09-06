'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import {
  createDemoTrace,
  isDemoKind,
  type DemoKind,
} from '@/lib/algorithm-demo';
import '@/app/algorithm-demo.css';

export function AlgorithmDemo({ kind }: { kind: string }) {
  if (!isDemoKind(kind)) return <p>该动画暂不可用，请参考本节的图示与例题。</p>;
  return <DemoPlayer key={kind} kind={kind} />;
}
function DemoPlayer({ kind }: { kind: DemoKind }) {
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
        <span className="algorithm-demo-eyebrow">交互演示 · 逐步观察</span>
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
        aria-label="算法当前状态"
      >
        {frame.cells.map((cell, i) => (
          <div
            key={i}
            className={`algorithm-demo-cell ${cell.state ? `is-${cell.state}` : ''}`}
            aria-label={`${cell.label}：${cell.value}${cell.state === 'active' ? '，当前处理' : cell.state === 'answer' ? '，答案' : ''}`}
          >
            <span>{cell.value}</span>
            <small>{cell.label}</small>
          </div>
        ))}
      </div>
      <div className="algorithm-demo-legend">
        <span>
          <i className="is-active" />
          当前处理
        </span>
        <span>
          <i className="is-visited" />
          已发现 / 已计算
        </span>
        <span>
          <i className="is-answer" />
          答案
        </span>
      </div>
      {frame.queue && (
        <div className="algorithm-demo-queue">
          <strong>队首 → 队尾</strong>
          <div>
            {frame.queue.length ? (
              frame.queue.map((item, i) => (
                <span key={`${item}:${i}`}>{item}</span>
              ))
            ) : (
              <span>空队列</span>
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
      <div className="algorithm-demo-controls" aria-label="演示控制">
        <button
          type="button"
          onClick={() => move(0)}
          disabled={step === 0 && !playing}
        >
          重置
        </button>
        <button
          type="button"
          onClick={() => move(step - 1)}
          disabled={step === 0}
        >
          上一步
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
          {playing ? '暂停' : step === last ? '重新播放' : '播放'}
        </button>
        <button
          type="button"
          onClick={() => move(step + 1)}
          disabled={step === last}
        >
          下一步
        </button>
        <label>
          速度
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            <option value={2200}>慢速</option>
            <option value={1200}>正常</option>
            <option value={650}>快速</option>
          </select>
        </label>
      </div>
      <label className="algorithm-demo-timeline">
        <span>
          步骤 {step + 1} / {trace.frames.length}
        </span>
        <input
          aria-label="选择演示步骤"
          type="range"
          min={0}
          max={last}
          value={step}
          onChange={(event) => move(Number(event.target.value))}
          aria-valuetext={`第 ${step + 1} 步，共 ${trace.frames.length} 步`}
        />
      </label>
      <p className="algorithm-demo-invariant">
        <strong>始终成立</strong>
        {trace.invariant}
      </p>
    </section>
  );
}
