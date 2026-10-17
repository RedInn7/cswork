'use client';

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import {
  createDemoTrace,
  demoInputs,
  guessTargets,
  isDemoKind,
  type DemoCell,
  type DemoGraph,
  type DemoKind,
  type Pair,
} from '@/lib/algorithm-demo';
import { useLocale, useT } from '@/lib/i18n';

// No CSS import here, so pure node tests can render pages that embed a demo:
// app/algorithm-demo.css is imported by components/lms-shared.tsx, app/topics/layout.tsx and app/learn/layout.tsx.

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
  const t = useT(),
    english = useLocale() === 'en';
  const custom = demoInputs[kind];
  const [args, setArgs] = useState<unknown[] | null>(null);
  const trace = useMemo(() => createDemoTrace(kind, english, args ?? undefined), [kind, english, args]);
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1200);
  const [text, setText] = useState(''),
    [error, setError] = useState<Pair | null>(null);
  const [guessing, setGuessing] = useState(false),
    [score, setScore] = useState({ right: 0, total: 0 }),
    [verdict, setVerdict] = useState<{ right: boolean; answer: string } | null>(null);
  const titleId = useId(),
    captionId = useId(),
    inputId = useId(),
    errorId = useId();
  const frame = trace.frames[step],
    last = trace.frames.length - 1;
  const targets = useMemo(
    () => (guessing && step < last ? guessTargets(trace.frames[step], trace.frames[step + 1]) : new Set<string>()),
    [guessing, step, last, trace],
  );
  const asking = targets.size > 0;
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
    setVerdict(null);
    setStep(next);
  };
  const restart = (next: unknown[] | null) => {
    setArgs(next);
    setScore({ right: 0, total: 0 });
    move(0);
  };
  /** A guess (a clicked cell or node key), or null for "show me": either way the step plays. */
  const guess = (key: string | null) => {
    const right = key !== null && targets.has(key);
    // Name the answer by its nodes when the frame draws a graph, else by its cells.
    const nodes = [...targets].filter((k) => k[0] === 'n');
    const answer = (nodes.length ? nodes : [...targets]).map((k) => {
      if (k[0] === 'n') {
        const node = frame.graph!.nodes.find((n) => `n${n.id}` === k)!;
        return node.label || node.note || node.id;
      }
      const cell = frame.cells[Number(k.slice(1))];
      return cell.label ? `${cell.label}: ${cell.value}` : String(cell.value);
    });
    setScore((s) => ({ right: s.right + Number(right), total: s.total + 1 }));
    setVerdict({ right, answer: answer.join(t('、', ', ')) });
    setStep(step + 1);
  };
  const cellName = (cell: DemoCell) =>
    t(
      `${cell.label}：${cell.value}${cell.state === 'active' ? '，当前处理' : cell.state === 'answer' ? '，答案' : ''}`,
      `${cell.label}: ${cell.value}${cell.state === 'active' ? ', current' : cell.state === 'answer' ? ', answer' : ''}`,
    );
  return (
    <section className="algorithm-demo" aria-labelledby={titleId}>
      <header className="algorithm-demo-header">
        <span className="algorithm-demo-eyebrow">
          {t('交互演示 · 逐步观察', 'Interactive demo · step by step')}
        </span>
        <h3 id={titleId}>{trace.title}</h3>
        <p>{trace.question}</p>
      </header>
      {custom && (
        <details className="algorithm-demo-input">
          <summary>{t('换个输入', 'Try your own input')}</summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = custom.parse(text);
              if ('error' in parsed) return setError(parsed.error);
              setError(null);
              restart(parsed.args);
            }}
          >
            <label htmlFor={inputId}>{t(...custom.label)}</label>
            <div>
              <input
                id={inputId}
                value={text}
                placeholder={custom.placeholder}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => setText(event.target.value)}
              />
              <button type="submit">{t('应用', 'Apply')}</button>
              <button
                type="button"
                onClick={() => {
                  setText('');
                  setError(null);
                  restart(null);
                }}
              >
                {t('恢复默认', 'Restore default')}
              </button>
            </div>
            {error && (
              <p className="algorithm-demo-error" id={errorId} role="alert">
                {t(...error)}
              </p>
            )}
          </form>
        </details>
      )}
      {frame.graph && <DemoGraphView graph={frame.graph} onPick={guessing ? guess : undefined} idle={!asking} />}
      {frame.cells.length > 0 && (
      <div
        className={`algorithm-demo-cells ${trace.columns ? 'algorithm-demo-grid' : ''} ${(trace.columns ?? 0) >= 6 ? 'is-dense' : ''} ${(trace.columns ?? 0) > 8 ? 'is-wide' : ''}`}
        style={
          trace.columns
            ? {
                gridTemplateColumns: `repeat(${trace.columns}, minmax(0, 1fr))`,
              }
            : undefined
        }
        aria-label={t('算法当前状态', 'Current algorithm state')}
      >
        {frame.cells.map((cell, i) => {
          const className = `algorithm-demo-cell ${cell.state ? `is-${cell.state}` : ''}`;
          const body = (
            <>
              <span>{cell.value}</span>
              <small>{cell.label}</small>
            </>
          );
          // Predict mode: every cell is a button, so the answer isn't given away. They stay
          // buttons (aria-disabled) between questions, so keyboard focus stays put.
          return guessing ? (
            <button
              key={i}
              type="button"
              className={className}
              aria-label={cellName(cell)}
              aria-disabled={asking ? undefined : true}
              onClick={() => asking && guess(`c${i}`)}
            >
              {body}
            </button>
          ) : (
            <div key={i} className={className} aria-label={cellName(cell)}>
              {body}
            </div>
          );
        })}
      </div>
      )}
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
          <strong>{trace.queueLabel ?? t('队首 → 队尾', 'Front → back')}</strong>
          <div>
            {frame.queue.length ? (
              frame.queue.map((item, i) => (
                <span key={`${item}:${i}`}>{item}</span>
              ))
            ) : (
              <span>{t('空', 'Empty')}</span>
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
      {guessing && (
        <div className="algorithm-demo-guess" aria-live="polite">
          {verdict && (
            <p className={verdict.right ? 'is-right' : 'is-wrong'}>
              <strong>{verdict.right ? t('✓ 猜对了', '✓ Right') : t('✗ 没猜中', '✗ Not this time')}</strong>{' '}
              {t(`下一步变成当前处理的是 ${verdict.answer}，原因见下方说明。`, `It was ${verdict.answer}; the caption below says why.`)}
            </p>
          )}
          <p>
            {asking
              ? t('下一步哪个格子或节点会变成「当前处理」（蓝色）？点它。', 'Which cell or node turns current (blue) next? Click it.')
              : step < last
                ? t('下一步没有新的格子或节点变成当前处理，按「下一步」继续。', 'Nothing new turns current next: press Next to go on.')
                : t('演示结束。', 'That is the end of the demo.')}
            <span className="algorithm-demo-score">
              {t(`本轮答对 ${score.right} / ${score.total}`, `This round: ${score.right} / ${score.total} right`)}
            </span>
          </p>
        </div>
      )}
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
          onClick={() => restart(args)}
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
          disabled={guessing}
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
          onClick={() => (asking ? guess(null) : move(step + 1))}
          disabled={step === last}
        >
          {asking ? t('看答案', 'Show me') : t('下一步', 'Next')}
        </button>
        <button
          type="button"
          aria-pressed={guessing}
          onClick={() => {
            setGuessing((g) => !g);
            setPlaying(false);
            setVerdict(null);
            setScore({ right: 0, total: 0 });
          }}
        >
          {t('先猜下一步', 'Predict the next step')}
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

const R = 4.2;
/**
 * A frame's graph or tree in SVG. Arrowheads are drawn per edge (no shared marker), so they
 * take the edge's state colour; the caption below narrates each step for screen readers.
 */
export function DemoGraphView({
  graph,
  onPick,
  idle = false,
}: {
  graph: DemoGraph;
  /** Predict mode: nodes become buttons that report `n<id>`; `idle` while there is no question. */
  onPick?: (key: string) => void;
  idle?: boolean;
}) {
  const t = useT();
  const at = new Map(graph.nodes.map((n) => [n.id, n]));
  const stateWord = (state?: string) =>
    state === 'active'
      ? t('，当前', ', current')
      : state === 'answer'
        ? t('，结果', ', result')
        : state === 'visited'
          ? t('，已处理', ', done')
          : '';
  const name = (n: DemoGraph['nodes'][number]) =>
    `${n.label || n.note || n.id}${n.label && n.note ? ` (${n.note})` : ''}${stateWord(n.state)}`;
  return (
    <svg
      className="algorithm-demo-graph"
      viewBox={`0 0 ${graph.width} ${graph.height}`}
      // Predict mode: the nodes become buttons, which an img role would hide.
      role={onPick ? 'group' : 'img'}
      aria-label={onPick ? t('图：点出下一步的节点', 'Graph: click the next node') : t('图：', 'Graph: ') + graph.nodes.map(name).join(t('；', '; '))}
    >
      {graph.edges.map((e) => {
        const a = at.get(e.from)!,
          b = at.get(e.to)!;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1,
          ux = (b.x - a.x) / len,
          uy = (b.y - a.y) / len;
        // The line runs border to border, so arrowheads land on the circle's edge.
        const x1 = a.x + ux * R,
          y1 = a.y + uy * R,
          x2 = b.x - ux * (R + 0.4),
          y2 = b.y - uy * (R + 0.4);
        return (
          <g key={`${e.from}>${e.to}`} className={`algorithm-demo-edge ${e.state ? `is-${e.state}` : ''}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            {e.directed && (
              <polygon
                points={`${x2},${y2} ${x2 - ux * 2.6 - uy * 1.5},${y2 - uy * 2.6 + ux * 1.5} ${x2 - ux * 2.6 + uy * 1.5},${y2 - uy * 2.6 - ux * 1.5}`}
              />
            )}
            {e.label && (
              <text x={(a.x + b.x) / 2 - uy * 3} y={(a.y + b.y) / 2 + ux * 3} dominantBaseline="middle" textAnchor="middle">
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {graph.nodes.map((n) => (
        <g
          key={n.id}
          className={`algorithm-demo-node ${n.state ? `is-${n.state}` : ''}`}
          {...(onPick ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': name(n),
            'aria-disabled': idle || undefined,
            onClick: () => !idle && onPick(`n${n.id}`),
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              if (!idle) onPick(`n${n.id}`);
            },
          } : {})}
        >
          <circle cx={n.x} cy={n.y} r={n.label ? R : R * 0.6} />
          {n.label && (
            <text x={n.x} y={n.y} dominantBaseline="central" textAnchor="middle">
              {n.label}
            </text>
          )}
          {n.note && (
            <text className="algorithm-demo-note" x={n.x} y={n.y + R + 3.2 + (n.noteDy ?? 0)} dominantBaseline="middle" textAnchor="middle">
              {n.note}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
