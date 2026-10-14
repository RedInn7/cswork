'use client';
import { useState } from 'react';
import { ChevronDown, CircleCheck } from 'lucide-react';
import type { SimilarProblem } from '@/lib/oj-client';
import '@/app/problem-aids.css';

const LEVEL: Record<string, [string, string]> = {
  简单: ['easy', 'Easy'],
  中等: ['medium', 'Medium'],
  困难: ['hard', 'Hard'],
};

/** A collapsed list of related problems under the statement; links open them in the app. */
export function SimilarProblems({
  items,
  english,
  navigate,
}: {
  items: SimilarProblem[];
  english: boolean;
  navigate: (view: string, extra?: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <section className="cs-similar" aria-labelledby="similar-problems-title">
      <h3 id="similar-problems-title">
        <button
          aria-expanded={open}
          aria-controls="similar-problems-list"
          onClick={() => setOpen((value) => !value)}
        >
          {english ? 'Similar problems' : '相似题'}
          <span className="cs-similar-count">{items.length}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </h3>
      <ul id="similar-problems-list" hidden={!open}>
        {items.map((item) => {
          const number = /^lc-(\d+)$/.exec(item.id)?.[1];
          const [level, levelEn] = LEVEL[item.difficulty] ?? ['medium', item.difficulty];
          return (
            <li key={item.id}>
              <a
                href={`/?view=problem&problem=${encodeURIComponent(item.id)}`}
                onClick={(event) => {
                  // A modified click keeps the browser's new-tab behaviour.
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) return;
                  event.preventDefault();
                  navigate('problem', { problem: item.id });
                }}
              >
                <span className="cs-similar-solved">
                  {item.solved && (
                    <>
                      <CircleCheck size={15} aria-hidden="true" />
                      <span className="sr-only">{english ? 'Solved: ' : '已通过：'}</span>
                    </>
                  )}
                </span>
                <span className="cs-similar-title">
                  {number ? `${number}. ` : ''}
                  {(english && item.titleEn) || item.title}
                </span>
                <span className={`cs-statement-difficulty ${level}`}>
                  {english ? levelEn : item.difficulty}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
