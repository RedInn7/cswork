import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Site paths and https links stay links; anything else is plain text. */
function href(value: string | undefined) {
  if (!value) return undefined;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** A guide chapter's Markdown, rendered on the server. Tables scroll on their own on a phone. */
export function GuideMarkdown({ body, labels }: { body: string; labels: { table: string; code: string } }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h2>{children}</h2>,
        a: ({ href: raw, children }) => {
          const to = href(raw);
          return !to ? (
            <span>{children}</span>
          ) : to.startsWith('/') ? (
            <a href={to}>{children}</a>
          ) : (
            <a href={to} rel="noopener noreferrer">
              {children}
            </a>
          );
        },
        img: () => null,
        table: ({ children }) => (
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard-reachable.
          <div className="guide-table" role="region" aria-label={labels.table} tabIndex={0}>
            <table>{children}</table>
          </div>
        ),
        pre: ({ children }) => (
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard-reachable.
          <pre role="region" aria-label={labels.code} tabIndex={0}>
            {children}
          </pre>
        ),
      }}
    >
      {body}
    </ReactMarkdown>
  );
}
