'use client';

import React, { Children, isValidElement, lazy, memo, Suspense, useEffect, useId, useRef, useState } from 'react';
import Markdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
import { useT } from '@/lib/i18n';
import { playgroundLanguage } from '@/lib/playground-share';
import { languages } from '@/lib/problems';
import remarkCodeTabs from '@/lib/remark-code-tabs';
import { RunInPlayground } from './run-in-playground';

// Imported statements use TeX-style scripts even inside Markdown inline code.
// Keep this deliberately narrow: bare carets need a numeric base and exponent,
// and braced scripts accept only identifiers/numbers/simple index arithmetic.
function mathText(children: React.ReactNode) {
  return Children.toArray(children).flatMap((child, index) => {
    if (typeof child !== 'string') return [child];
    const parts: React.ReactNode[] = [];
    let start = 0;
    const scripts = /([A-Za-z0-9)]+)(?:([\^_])\{([A-Za-z0-9]+(?:[+−-][A-Za-z0-9]+)?|[-−]\d+)\}|(\^)(-?\d+)(?![\w.]))/g;
    for (const match of child.matchAll(scripts)) {
      // Unbraced a^2 may be source code (XOR), so only format numeric powers.
      if (match[4] && !/^\d+$/.test(match[1])) continue;
      parts.push(child.slice(start, match.index), match[1]);
      const Tag = (match[2] || match[4]) === '^' ? 'sup' : 'sub';
      parts.push(<Tag key={`${index}:${match.index}`}>{(match[3] || match[5]).replace(/^-/, '−')}</Tag>);
      start = match.index! + match[0].length;
    }
    parts.push(child.slice(start));
    return parts;
  });
}

function proseText(children: React.ReactNode) {
  return Children.toArray(children).flatMap((child, index) => {
    if (typeof child !== 'string') return [child];
    const parts: React.ReactNode[] = [];
    let start = 0;
    // Imported `<strong> 原地 </strong>` became `** 原地 **`, `**原地 **` or
    // `** 原地**`, which Markdown cannot parse. Bold the words and keep each
    // space outside it; markers without any inner space are Markdown's own.
    for (const match of child.matchAll(
      /\*\*([ \t]*)(\S(?:[^*\n]*?\S)?)([ \t]*)\*\*/g,
    )) {
      if (!match[1] && !match[3]) continue;
      parts.push(child.slice(start, match.index), match[1] ? ' ' : '');
      parts.push(
        <strong key={`${index}:${match.index}`}>{match[2]}</strong>,
        match[3] ? ' ' : '',
      );
      start = match.index! + match[0].length;
    }
    parts.push(child.slice(start));
    return mathText(parts);
  });
}

function StatementStrong({ children }: { children?: React.ReactNode }) {
  return <strong>{mathText(children)}</strong>;
}

function StatementImage({ src, alt }: { src?: unknown; alt?: string }) {
  const t = useT();
  return typeof src === 'string' ? (
    <img
      src={src}
      alt={alt || t('题目图示', 'Problem illustration')}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : null;
}

const components: Components = {
  p: ({ children }) => {
    const parts = Children.toArray(children);
    const only = parts[0];
    if (
      parts.length === 1 &&
      isValidElement<{ children?: unknown }>(only) &&
      (only.type === 'strong' || only.type === StatementStrong) &&
      typeof only.props.children === 'string' &&
      /^(?:Example\s*\d*|Constraints|Follow[- ]up|示例\s*[一二三四五\d]*|提示|约束|进阶)\s*[:：]?$/i.test(
        only.props.children.trim(),
      )
    ) {
      return <h3>{children}</h3>;
    }
    // Some imported statements put a space before the closing strong marker.
    // Repair this presentation-only prefix without rewriting code blocks.
    if (typeof only === 'string') {
      const followUp =
        /^\s*\*\*(Follow-up|Follow up|进阶)([:：])\s+\*\*\s*/i.exec(only);
      if (followUp)
        return (
          <p>
            <strong>
              {followUp[1]}
              {followUp[2]}
            </strong>{' '}
            {only.slice(followUp[0].length)}
            {parts.slice(1)}
          </p>
        );
    }
    return <p>{proseText(children)}</p>;
  },
  li: ({ children }) => <li>{proseText(children)}</li>,
  code: ({ children }) => <code>{mathText(children)}</code>,
  strong: StatementStrong,
  em: ({ children }) => <em>{mathText(children)}</em>,
  pre: ({ children }) => {
    const code = Children.toArray(children)[0];
    if (
      !isValidElement<{ children?: unknown }>(code) ||
      typeof code.props.children !== 'string'
    ) {
      return <pre>{children}</pre>;
    }
    const text = code.props.children
      .replace(/^\s*\n/, '')
      .replace(/\n\s*$/, '');
    return (
      <pre>
        <code>
          {text.split('\n').map((line, index) => {
            const label =
              /^(\s*)(Input|Output|Explanation|输入|输出|解释)([:：]?)(.*)$/.exec(
                line,
              );
            return (
              <React.Fragment key={index}>
                {index > 0 ? '\n' : ''}
                {label ? (
                  <>
                    {label[1]}
                    <strong>
                      {label[2]}
                      {label[3]}
                    </strong>
                    {label[4]}
                  </>
                ) : (
                  line
                )}
              </React.Fragment>
            );
          })}
        </code>
      </pre>
    );
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  img: StatementImage,
};

/**
 * Imported statements wrote every `<strong>` and `</strong>` as `**`: inner
 * spaces (`** 原地 **`), empty (`****`), adjacent (`**1****1**`) and nested
 * (`****示例 2:****`, `**示例 **2:****`) bold. Markdown cannot pair those, and
 * one bad pair derails every later one in the paragraph. Per line, outside
 * fenced blocks and code spans, this re-pairs the markers like the original
 * tags: a run at the start of a line opens, at the end closes, inside a line
 * it first closes what is open, and a single marker closes when one is open.
 * Only the outermost pair is kept, adjacent pairs merge, empty ones go, and
 * inner spaces move outside. A line that does not balance is left to Markdown
 * (bold may legitimately continue on the next line).
 */
export function tidyImportedBold(body: string) {
  let fence = '';
  return body
    .split('\n')
    .flatMap((line) => {
      const opener = /^\s*(`{3,}|~{3,})/.exec(line)?.[1][0];
      if (opener && (!fence || opener === fence)) {
        fence = fence ? '' : opener;
        return [line];
      }
      if (fence) return [line];
      if (/^\s*\*{2,}\s*$/.test(line)) return [];
      return [tidyBoldLine(line)];
    })
    .join('\n');
}

type BoldRun = { at: number; end: number; opens: number; closes: number };

function tidyBoldLine(line: string) {
  const runs: BoldRun[] = [];
  for (const m of line.matchAll(/`+[^`]*?`+|\*+/g)) {
    if (m[0][0] === '`') continue;
    if (m[0].length % 2) return line; // `***`: not an imported tag sequence
    runs.push({
      at: m.index!,
      end: m.index! + m[0].length,
      opens: 0,
      closes: 0,
    });
  }
  if (!runs.length) return line;
  const lead = /^\s*(?:[-*+]\s+|\d+\.\s+)?$/;
  let depth = 0;
  const byDepth: BoldRun[] = []; // singles that closed only because one was open
  runs.forEach((run, i) => {
    const count = (run.end - run.at) / 2;
    const before = line[run.at - 1] ?? '';
    const after = line[run.end] ?? '';
    const atStart = i === 0 && lead.test(line.slice(0, run.at)) && count > 1;
    const atEnd =
      i === runs.length - 1 && !line.slice(run.end).trim() && count > 1;
    if (atStart) run.opens = count;
    else if (atEnd) {
      // Not enough open: some earlier single was an inner opener after a space.
      while (depth < count && byDepth.length) {
        const flip = byDepth.pop()!;
        ((flip.closes = 0), (flip.opens = 1), (depth += 2));
      }
      run.closes = Math.min(depth, count);
    } else if (count === 1) {
      if (depth) ((run.closes = 1), byDepth.push(run));
      else run.opens = 1;
    } else if (depth) {
      run.closes = Math.min(depth, count);
      run.opens = count - run.closes;
    } else if (/\s/.test(before) || !before) run.opens = count;
    // else: `最多****两次`, an empty pair inside text: nothing to keep
    depth += run.opens - run.closes;
  });
  if (depth) return line;
  // Keep only the outermost markers; a close and reopen in one run merge.
  let out = '';
  let at = 0;
  let level = 0;
  let open = -1;
  for (const run of runs) {
    const closesOuter = run.closes > 0 && level - run.closes === 0;
    level -= run.closes;
    const opensOuter = run.opens > 0 && level === 0;
    level += run.opens;
    if (closesOuter && opensOuter) {
      out += line.slice(at, run.at); // `**1****1**`: one bold continues
    } else if (closesOuter) {
      const inner = out.slice(open) + line.slice(at, run.at);
      out = out.slice(0, open);
      const body = inner.trim();
      const spaceBefore = open > 0 && !/\s/.test(out[out.length - 1] ?? ' ');
      const spaceAfter = run.end < line.length && !/\s/.test(line[run.end]);
      if (body)
        out +=
          (/^\s/.test(inner) && spaceBefore ? ' ' : '') +
          '**' +
          body +
          '**' +
          (/\s$/.test(inner) && spaceAfter ? ' ' : '');
      else if (inner && spaceBefore && spaceAfter) out += ' ';
    } else {
      out += line.slice(at, run.at);
      if (opensOuter) open = out.length;
    }
    at = run.end;
  }
  return out + line.slice(at);
}

// CJK-friendly emphasis: CommonMark cannot close `**进阶：**尝试` (punctuation
// before the closing marker, a CJK letter after it); this plugin can.
const MARKDOWN_PLUGINS = [remarkGfm, remarkCjkFriendly];
// Text we did not write (AI replies): no image can load and no link can be followed,
// whatever Markdown form it takes (inline, reference, autolink, bare URL). Links keep their text.
const PLAIN = ['img', 'a'];
// Other learners' posts: links stay, images never load (no tracking pixels).
const UNTRUSTED_HIDDEN = ['img'];
// Other learners' posts also get ```spoiler blocks, math and language tabs; statements do not.
const POST_PLUGINS = [...MARKDOWN_PLUGINS, remarkCodeTabs];
// Same limits as the library's math; trust off, so no \href, \url or HTML from a post.
const KATEX = { maxSize: 10, maxExpand: 200, trust: false };
type MathPlugins = typeof import('./markdown-math');
type MdNode = { type: string; value?: string; children?: MdNode[]; position?: { start: { offset?: number }; end: { offset?: number } } };
/**
 * `$5 和 $10` is money, not math: as in Pandoc, inline math may not start or end with a space
 * nor run into a digit, and such a pair goes back to its source text.
 * ponytail: Markdown inside a reverted pair (`$5 **off**, $10`) stays literal; `\$` always works.
 */
const remarkMoney = () => (tree: MdNode, file: { value?: unknown }) => {
  const source = typeof file.value === 'string' ? file.value : '';
  const walk = (node: MdNode) =>
    node.children?.forEach((child, i, list) => {
      if (child.type !== 'inlineMath') return walk(child);
      const raw = source.slice(child.position?.start.offset ?? 0, child.position?.end.offset ?? 0);
      if (/^\$+\s|\s\$+$/.test(raw) || /^\d/.test(list[i + 1]?.value ?? '')) list[i] = { type: 'text', value: raw };
    });
  walk(tree);
};
// Loaded only when a post has a diagram: mermaid and its dialog stay out of every other bundle.
const CourseDiagram = lazy(() => import('./course-diagram').then((m) => ({ default: m.CourseDiagram })));

/** A post's code block: a ```mermaid diagram (with `diagrams`), a ```spoiler fold, or code that opens in the playground. */
function PostPre({ node, children, diagrams = false }: ExtraProps & { children?: React.ReactNode; diagrams?: boolean }) {
  const t = useT();
  const code = Children.toArray(children)[0];
  if (!isValidElement<{ className?: string; children?: unknown }>(code) || typeof code.props.children !== 'string')
    return <pre>{children}</pre>;
  const source = code.props.children;
  const tag = /(?:^|\s)language-(\S+)/.exec(code.props.className ?? '')?.[1];
  // A post's ```mermaid blocks draw as the course diagrams do (strict mermaid, an isolated image).
  if (diagrams && tag === 'mermaid')
    return (
      <Suspense fallback={<pre>{children}</pre>}>
        <CourseDiagram source={source} />
      </Suspense>
    );
  if (tag === 'spoiler') {
    // ```spoiler Title: the words after the tag are the code element's meta.
    const title = (node?.children[0] as { data?: { meta?: string | null } } | undefined)?.data?.meta?.trim();
    return (
      <details className="cs-spoiler">
        <summary>{title || t('剧透', 'Spoiler')}</summary>
        <div className="cs-spoiler-body">
          <PostMarkdown body={source} diagrams={diagrams} />
        </div>
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
}

/** Consecutive blocks in different languages (remarkCodeTabs) as one tab set. */
function CodeTabs({ langs, children }: { langs: string[]; children?: React.ReactNode }) {
  const t = useT();
  const id = useId();
  const [at, setAt] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const panels = Children.toArray(children).filter(isValidElement);
  const move = (e: React.KeyboardEvent) => {
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

// The overrides above repair imported statements (bold, scripts, labels); a learner's text renders as typed.
// Posts cannot write HTML, so the only div is remarkCodeTabs'.
const UNTRUSTED_COMPONENTS: Components = {
  a: components.a,
  pre: ({ node, children }) => <PostPre node={node}>{children}</PostPre>,
  div: ({ node, className, children }) =>
    className === 'cs-code-tabs' ? (
      <CodeTabs langs={String(node?.properties.dataLangs ?? '').split(' ')}>{children}</CodeTabs>
    ) : (
      <div className={className}>{children}</div>
    ),
};
const DIAGRAM_COMPONENTS: Components = {
  ...UNTRUSTED_COMPONENTS,
  pre: ({ node, children }) => (
    <PostPre node={node} diagrams>
      {children}
    </PostPre>
  ),
};

/** Another learner's text; TeX (anything with a `$`) renders once KaTeX has loaded. */
function PostMarkdown({ body, diagrams, plain = false }: { body: string; diagrams: boolean; plain?: boolean }) {
  const dollar = body.includes('$');
  const [math, setMath] = useState<MathPlugins | null>(null);
  useEffect(() => {
    // Without KaTeX the TeX stays readable as typed, so a failed load keeps the plain view.
    if (dollar) import('./markdown-math').then(setMath, () => {});
  }, [dollar]);
  const on = dollar && math;
  return (
    <Markdown
      remarkPlugins={on ? [...POST_PLUGINS, on.remarkMath, remarkMoney] : POST_PLUGINS}
      rehypePlugins={on ? [[on.rehypeKatex, KATEX]] : undefined}
      components={diagrams ? DIAGRAM_COMPONENTS : UNTRUSTED_COMPONENTS}
      disallowedElements={plain ? PLAIN : UNTRUSTED_HIDDEN}
      unwrapDisallowed={plain}
    >
      {body}
    </Markdown>
  );
}
// Parsing the statement is the costliest part of a workspace render; the many
// re-renders while a submission is judged (status, verdict, history) skip it.
export const StatementMarkdown = memo(function StatementMarkdown({
  body,
  className = 'cs-statement-markdown',
  plain = false,
  untrusted = false,
  diagrams = false,
}: {
  body: string;
  className?: string;
  plain?: boolean;
  /** Other learners' text: rendered as typed (none of the imported-statement repairs) and
   *  without images, so a post cannot load a tracking pixel for its readers. */
  untrusted?: boolean;
  /** With untrusted: ```mermaid blocks draw as diagrams (text only, still no images or HTML). */
  diagrams?: boolean;
}) {
  return (
    <article className={className}>
      {untrusted ? (
        <PostMarkdown body={body} diagrams={diagrams} plain={plain} />
      ) : (
        <Markdown
          remarkPlugins={MARKDOWN_PLUGINS}
          components={components}
          disallowedElements={plain ? PLAIN : undefined}
          unwrapDisallowed={plain}
        >
          {tidyImportedBold(body)}
        </Markdown>
      )}
    </article>
  );
});
