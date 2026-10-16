import { Children, isValidElement } from 'react';
import ReactMarkdown, { type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CourseDiagram } from '@/components/course-diagram';
import { RunInPlayground } from '@/components/run-in-playground';
import { playgroundLanguage } from '@/lib/playground-share';
import remarkMoney from '@/lib/remark-money';

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

/** Section ids: a heading's text lowercased, punctuation dropped (Chinese kept); repeats get -2, -3. */
function headingIds() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const id = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return n > 1 ? `${id}-${n}` : id;
  };
}

/** The body's sections for a table of contents: its top-level # and ## headings (both render as h2). */
export function markdownToc(body: string) {
  const id = headingIds();
  const toc: { id: string; text: string }[] = [];
  let fenced = false;
  for (const line of body.split('\n')) {
    if (/^ {0,3}(?:```|~~~)/.test(line)) fenced = !fenced;
    const heading = fenced ? null : /^ {0,3}##? +(.+?)(?: +#+)? *$/.exec(line);
    if (!heading) continue;
    const text = heading[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '');
    toc.push({ id: id(text), text });
  }
  return toc;
}

type Hast = { type: string; tagName?: string; value?: string; properties?: object; children?: Hast[] };
const textOf = (node: Hast): string => node.value ?? (node.children ?? []).map(textOf).join('');
/** Gives the top-level h1/h2 headings the ids markdownToc() lists. */
const rehypeHeadingIds = () => (tree: Hast) => {
  const id = headingIds();
  for (const node of tree.children ?? [])
    if (node.tagName === 'h1' || node.tagName === 'h2') node.properties = { ...node.properties, id: id(textOf(node)) };
};

/** Matches the workspace's notation/link policy while rendering entirely on the server. */
export function PublicLibraryMarkdown({
  body,
  math,
  ugc = false,
  sectionIds = false,
  nested = false,
}: {
  body: string;
  math: boolean;
  /** Member-written text: its links carry no endorsement, and with math `$5 and $10` stays money. */
  ugc?: boolean;
  /** Section headings get ids, for a table of contents (markdownToc). */
  sectionIds?: boolean;
  /** Inside a spoiler: a ```spoiler there stays code, so folds cannot nest (each one parses its body again). */
  nested?: boolean;
}) {
  const rehypePlugins: NonNullable<Options['rehypePlugins']> = [];
  if (math) rehypePlugins.push([rehypeKatex, { maxSize: 10, maxExpand: 200 }]);
  if (sectionIds) rehypePlugins.push(rehypeHeadingIds);
  return (
    <ReactMarkdown
      remarkPlugins={math ? [remarkGfm, remarkMath, ...(ugc ? [remarkMoney] : [])] : [remarkGfm]}
      rehypePlugins={rehypePlugins}
      components={{
        h1: ({ children, id }) => <h2 id={id}>{children}</h2>,
        pre: ({ node, children }) => {
          const code = Children.toArray(children)[0];
          if (!isValidElement<{ className?: string; children?: unknown }>(code) || typeof code.props.children !== 'string')
            return <pre>{children}</pre>;
          const source = code.props.children;
          const tag = /(?:^|\s)language-(\S+)/.exec(code.props.className ?? '')?.[1];
          // Our own mermaid blocks draw in the browser; the server page carries their source.
          if (!ugc && tag === 'mermaid') return <CourseDiagram source={source} />;
          // A member's ```spoiler Title stays folded here too (the app's post view does the same).
          if (ugc && !nested && tag === 'spoiler') {
            const title = (node?.children[0] as { data?: { meta?: string | null } } | undefined)?.data?.meta?.trim();
            return (
              <details className="cs-spoiler">
                <summary>{title || '剧透 · Spoiler'}</summary>
                <PublicLibraryMarkdown body={source} math={math} ugc nested />
              </details>
            );
          }
          const language = playgroundLanguage(tag);
          return (
            <>
              <pre>{children}</pre>
              {language && <RunInPlayground code={source} language={language} />}
            </>
          );
        },
        a: ({ node, href, children }) =>
          // In-app views and the system design course's own chapters.
          href?.startsWith('/?view=') || /^\/system-design(?:\/[a-z0-9-]+)?$/.test(href ?? '') ? (
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
