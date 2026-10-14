import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function safeLink(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** Matches the workspace's notation/link policy while rendering entirely on the server. */
export function PublicLibraryMarkdown({
  body,
  math,
  ugc = false,
}: {
  body: string;
  math: boolean;
  /** Member-written text: its links carry no endorsement. */
  ugc?: boolean;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={math ? [remarkGfm, remarkMath] : [remarkGfm]}
      rehypePlugins={
        math ? [[rehypeKatex, { maxSize: 10, maxExpand: 200 }]] : []
      }
      components={{
        h1: ({ children }) => <h2>{children}</h2>,
        a: ({ node, href, children }) =>
          href?.startsWith('/?view=') ? (
            <a href={href}>{children}</a>
          ) : safeLink(href) ? (
            <a href={safeLink(href)} rel={ugc ? 'ugc nofollow noopener noreferrer' : 'noopener noreferrer'}>
              {children}
            </a>
          ) : !href ||
            href.startsWith('#') ||
            /^[a-z][a-z0-9+.-]*:/i.test(href) ? (
            <span>{children}</span>
          ) : (
            <span>
              {body.slice(
                node?.position?.start.offset ?? 0,
                node?.position?.end.offset ?? 0,
              ) || children}
            </span>
          ),
        img: ({ src, alt }) =>
          typeof src === 'string' && /^\/content-assets\/[\w.-]+$/.test(src) ? (
            // oxlint-disable-next-line nextjs/no-img-element -- Existing published article images are served locally.
            <img src={src} alt={alt || ''} loading="lazy" decoding="async" />
          ) : (
            <span>{alt ? `[Image: ${alt}]` : '[Image]'}</span>
          ),
      }}
    >
      {body}
    </ReactMarkdown>
  );
}
