'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  FLOWCHART,
  isLeaf,
  questionOrder,
  stopLabel,
  type Leaf,
  type Question,
} from '@/lib/pattern-flowchart';

const { start, nodes } = FLOWCHART;
const order = questionOrder();
const number = new Map(order.map((id, i) => [id, String(i + 1).padStart(2, '0')] as const));
const noop = () => () => {};

/** Tutorial slug -> its title in the page language, for the tutorials the library has. */
export type Tutorials = Record<string, string>;

/** A leaf: the stop, why, and the ways on. On the board its name is the step's heading. */
function Arrival({
  leaf,
  zh,
  tutorials,
  heading,
}: {
  leaf: Leaf;
  zh: boolean;
  tutorials: Tutorials;
  heading?: React.Ref<HTMLHeadingElement>;
}) {
  const stop = stopLabel(leaf.stop);
  const tutorial = leaf.tutorial && Object.hasOwn(tutorials, leaf.tutorial) ? leaf.tutorial : '';
  const name = (
    <>
      <span className="flow-code" aria-hidden="true">
        {stop.code}
      </span>
      <span className="sr-only">{zh ? `第 ${stop.code} 站：` : `Stop ${stop.code}: `}</span>
      <span>{zh ? stop.zh : stop.en}</span>
    </>
  );
  return (
    <div className="flow-arrival">
      {heading ? (
        <h2 id="flow-now" ref={heading} tabIndex={-1} className="flow-stop flow-now">
          {name}
        </h2>
      ) : (
        <p className="flow-stop">{name}</p>
      )}
      <p className="flow-why">{leaf.why[zh ? 0 : 1]}</p>
      <p className="flow-links">
        <a href={`/?view=problems&section=${encodeURIComponent(leaf.stop)}`}>
          {zh ? `去第 ${stop.code} 站刷题` : `Practice stop ${stop.code}`} <span aria-hidden="true">→</span>
        </a>
        {tutorial && (
          <a href={`/library/algorithm/${encodeURIComponent(tutorial)}`}>
            {zh ? '教程：' : 'Tutorial: '}
            {tutorials[tutorial]}
          </a>
        )}
      </p>
    </div>
  );
}

/**
 * The guided walk (one question at a time, with back and restart) over the whole tree as an
 * outline. Without JavaScript the walk stays hidden and the outline is open; its answers are
 * in-page links, so it still works as a choose-your-path list.
 */
export function FlowchartWalk({ zh, tutorials }: { zh: boolean; tutorials: Tutorials }) {
  const l = zh ? 0 : 1;
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const [path, setPath] = useState([start]);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const outline = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (outline.current) outline.current.open = false;
  }, []);
  useEffect(() => {
    // Keyboard and screen reader users land on the new question; not on first load.
    if (moved.current) heading.current?.focus();
  }, [path]);
  const go = (next: string[]) => {
    moved.current = true;
    setPath(next);
  };
  const id = path[path.length - 1];
  const node = nodes[id];
  const yes = zh ? '是' : 'Yes',
    no = zh ? '否' : 'No';
  return (
    <>
      <section className="flow-walk" hidden={!hydrated} aria-label={zh ? '逐题回答' : 'Answer step by step'}>
        <div className="flow-board">
          {/* Keyed so each step mounts fresh and plays its entrance. */}
          <div className="flow-step" key={id}>
            {isLeaf(node) ? (
              <>
                <p className="flow-kicker">{zh ? '建议在这一站下车' : 'Get off at this stop'}</p>
                <Arrival leaf={node} zh={zh} tutorials={tutorials} heading={heading} />
              </>
            ) : (
              <>
                <p className="flow-kicker">
                  {zh ? `第 ${path.length} 问` : `Question ${path.length}`}
                  <span aria-hidden="true"> · Q{number.get(id)}</span>
                </p>
                <h2 id="flow-now" ref={heading} tabIndex={-1} className="flow-now">
                  {node.q[l]}
                </h2>
                <p className="flow-eg">{node.eg[l]}</p>
                <div className="flow-answers">
                  <button type="button" data-answer="yes" onClick={() => go([...path, node.yes])}>
                    {yes}
                  </button>
                  <button type="button" data-answer="no" onClick={() => go([...path, node.no])}>
                    {no}
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="flow-controls">
            <button type="button" disabled={path.length < 2} onClick={() => go(path.slice(0, -1))}>
              <span aria-hidden="true">←</span> {zh ? '上一步' : 'Back'}
            </button>
            <button type="button" disabled={path.length < 2} onClick={() => go([start])}>
              {zh ? '从头开始' : 'Start over'}
            </button>
          </div>
        </div>
        {path.length > 1 && (
          <div className="flow-trail">
            <h3>{zh ? '你的回答' : 'Your answers'}</h3>
            <ol>
              {path.slice(0, -1).map((step, i) => {
                const asked = nodes[step] as Question;
                const said = path[i + 1] === asked.yes ? yes : no;
                return (
                  <li key={step}>
                    <button
                      type="button"
                      onClick={() => go(path.slice(0, i + 1))}
                      aria-label={
                        zh
                          ? `回到这一问：${asked.q[0]}（当时答：${said}）`
                          : `Go back to: ${asked.q[1]} (you said ${said})`
                      }
                    >
                      <span className="flow-trail-q">{asked.q[l]}</span>
                      <span className="flow-trail-a" data-answer={said === yes ? 'yes' : 'no'}>
                        {said}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>
      <details className="flow-outline" open ref={outline}>
        <summary>
          {zh ? `查看全部 ${order.length} 个问题` : `See all ${order.length} questions`}
        </summary>
        <ol className="flow-list">
          {order.map((qid) => {
            const q = nodes[qid] as Question;
            return (
              <li key={qid} id={qid}>
                <p className="flow-q">
                  <span className="flow-num">Q{number.get(qid)}</span> {q.q[l]}
                </p>
                <p className="flow-eg">{q.eg[l]}</p>
                <dl>
                  {(['yes', 'no'] as const).map((choice) => {
                    const target = nodes[q[choice]];
                    return (
                      <div key={choice} data-answer={choice}>
                        <dt>{choice === 'yes' ? yes : no}</dt>
                        <dd>
                          {isLeaf(target) ? (
                            <Arrival leaf={target} zh={zh} tutorials={tutorials} />
                          ) : (
                            <a href={`#${q[choice]}`}>
                              <span aria-hidden="true">→ </span>Q{number.get(q[choice])}{' '}
                              {target.q[l]}
                            </a>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            );
          })}
        </ol>
      </details>
    </>
  );
}
