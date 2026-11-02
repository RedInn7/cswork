'use client';
import { useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';

hljs.registerLanguage('python', python);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('go', go);
hljs.registerLanguage('sql', sql);
const GRAMMAR: Record<string, string> = { python: 'python', pandas: 'python', cpp: 'cpp', java: 'java', go: 'go', sql: 'sql' };
// highlight.js scope -> this site's palette (.cs-tok-* in app/globals.css, light and dark).
const KIND: Record<string, string> = {
  keyword: 'keyword',
  literal: 'keyword',
  string: 'string',
  regexp: 'regexp',
  comment: 'comment',
  number: 'number',
  type: 'type',
  built_in: 'predefined',
  title: 'type',
  meta: 'annotation',
  operator: 'operator',
};

/** highlight.js HTML (text already escaped) with its classes swapped for .cs-tok-* ones. */
export function highlightHtml(code: string, language: string) {
  const grammar = GRAMMAR[language];
  if (!grammar) return undefined;
  return hljs
    .highlight(code, { language: grammar, ignoreIllegals: true })
    .value.replace(/<span class="hljs-([a-z_]+)[^"]*">/g, (_, scope: string) =>
      KIND[scope] ? `<span class="cs-tok-${KIND[scope]}">` : '<span>',
    );
}

/** Read-only code with syntax colours, for editorials; unknown languages stay plain text. */
export function HighlightedCode({ code, language, className }: { code: string; language: string; className?: string }) {
  const html = useMemo(() => highlightHtml(code, language), [code, language]);
  return <pre className={className}>{html === undefined ? <code>{code}</code> : <code dangerouslySetInnerHTML={{ __html: html }} />}</pre>;
}
