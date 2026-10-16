'use client';
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { playgroundHref } from '@/lib/playground-share';
import type { CodeLanguage } from '@/lib/problems';

/**
 * Opens a code block in /playground in a new tab. The playground never runs it on its own and
 * keeps the learner's code to restore, so any block may carry this. Snippets without a main
 * (LeetCode-style functions) open but do not run as is: hence "open", not "run".
 */
export function RunInPlayground({ code, language, stdin = '' }: { code: string; language: CodeLanguage; stdin?: string }) {
  const t = useT();
  // undefined while the link is packed; null when it would be too long to share.
  const [href, setHref] = useState<string | null>();
  useEffect(() => {
    let live = true;
    playgroundHref({ language, code, stdin }).then(
      (value) => live && setHref(value),
      () => live && setHref(null),
    );
    return () => {
      live = false;
    };
  }, [code, language, stdin]);
  const label = t('在 Playground 打开', 'Open in Playground');
  return (
    <div className="cs-run-playground">
      {href ? (
        <a href={href} target="_blank" rel="noopener">
          {label}
          <ExternalLink size={12} aria-hidden="true" />
          <span className="sr-only">{t('（新标签页）', ' (new tab)')}</span>
        </a>
      ) : (
        <button type="button" disabled>
          {href === null ? t('代码太长，无法在 Playground 打开', 'Too long to open in Playground') : label}
        </button>
      )}
    </div>
  );
}
