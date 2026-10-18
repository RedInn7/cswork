'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '@/lib/i18n';
import { languages } from '@/lib/problems';

/**
 * Consecutive blocks in different languages (lib/remark-code-tabs.ts) as one tab set. The caller
 * passes each block as a panel (Children.toArray(children).filter(isValidElement)): counted on the
 * server, since a server render flattens a pre override's Fragment and children here would misalign.
 */
export function CodeTabs({ langs, panels }: { langs: string[]; panels: ReactNode[] }) {
  const t = useT();
  const id = useId();
  const [at, setAt] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const move = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (at + step + langs.length) % langs.length;
    setAt(next);
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };
  return (
    <div className="cs-code-tabs">
      <div role="tablist" aria-label={t('代码语言', 'Code language')} ref={list}>
        {langs.map((lang, i) => (
          <button
            key={lang}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === at}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={i === at ? 0 : -1}
            onClick={() => setAt(i)}
            onKeyDown={move}
          >
            {languages.find((item) => item.id === lang)?.name ?? lang}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div key={i} role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} hidden={i !== at}>
          {panel}
        </div>
      ))}
    </div>
  );
}
