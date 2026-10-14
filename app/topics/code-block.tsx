import { Fragment } from 'react';
import { commentStart, type TemplateLang } from '@/lib/route-templates';

/** Server-rendered code with trailing comments dimmed; focusable so keyboards can scroll it. */
export function CodeBlock({ code, lang, label }: { code: string; lang: TemplateLang; label: string }) {
  return (
    <pre className="topics-pre" role="region" tabIndex={0} aria-label={label}>
      <code translate="no">
        {code.split('\n').map((line, i) => {
          const at = commentStart(line, lang);
          return (
            <Fragment key={i}>
              {i > 0 && '\n'}
              {at < 0 ? (
                line
              ) : (
                <>
                  {line.slice(0, at)}
                  <span className="topics-comment">{line.slice(at)}</span>
                </>
              )}
            </Fragment>
          );
        })}
      </code>
    </pre>
  );
}
