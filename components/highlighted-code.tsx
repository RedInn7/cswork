'use client';
import { useEffect, useState, type ReactNode } from 'react';

// Monaco's grammars for these are loaded by components/monaco-client.ts; anything else stays plain.
const GRAMMAR: Record<string, string> = { python: 'python', pandas: 'python', cpp: 'cpp', java: 'java', go: 'go', sql: 'sql' };
// A token's first type segment ("keyword.python" -> keyword) picks its colour (.cs-tok-* in app/globals.css).
const KINDS = new Set(['keyword', 'string', 'comment', 'number', 'type', 'annotation', 'predefined', 'regexp', 'operator']);

/**
 * Read-only code with syntax colours, for editorials. Plain text first; once Monaco's runtime
 * loads, its tokenizer splits the code and the colours come from this site's light and dark
 * palettes, so it never changes the global Monaco theme the code editor uses.
 */
export function HighlightedCode({ code, language, className }: { code: string; language: string; className?: string }) {
  const [lines, setLines] = useState<ReactNode[] | null>(null);
  useEffect(() => {
    setLines(null);
    const grammar = GRAMMAR[language];
    if (!grammar) return;
    let live = true;
    import('./monaco-client')
      .then(({ monaco }) => {
        if (!live) return;
        const source = code.split('\n');
        const tokens = monaco.editor.tokenize(code, grammar);
        setLines(
          source.map((text, row) => {
            const line = tokens[row] ?? [];
            return (
              <span key={row}>
                {line.map((token, i) => {
                  const part = text.slice(token.offset, line[i + 1]?.offset ?? text.length);
                  const kind = token.type.split('.')[0];
                  return KINDS.has(kind) ? (
                    <span key={i} className={`cs-tok-${kind}`}>
                      {part}
                    </span>
                  ) : (
                    part
                  );
                })}
                {row < source.length - 1 && '\n'}
              </span>
            );
          }),
        );
      })
      .catch(() => {
        /* Plain text is still the whole code. */
      });
    return () => {
      live = false;
    };
  }, [code, language]);
  return (
    <pre className={className}>
      <code>{lines ?? code}</code>
    </pre>
  );
}
