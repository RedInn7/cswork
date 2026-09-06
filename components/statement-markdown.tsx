'use client';

import React, { Children, isValidElement } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    for (const match of child.matchAll(/\*\*([^*\n]*?\S)[ \t]+\*\*/g)) {
      parts.push(child.slice(start, match.index));
      parts.push(
        <strong key={`${index}:${match.index}`}>{match[1]}</strong>,
        ' ',
      );
      start = match.index! + match[0].length;
    }
    parts.push(child.slice(start));
    return mathText(parts);
  });
}

const components: Components = {
  p: ({ children }) => {
    const parts = Children.toArray(children);
    const only = parts[0];
    if (
      parts.length === 1 &&
      isValidElement<{ children?: unknown }>(only) &&
      only.type === 'strong' &&
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
  strong: ({ children }) => <strong>{mathText(children)}</strong>,
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
  img: ({ src, alt }) =>
    typeof src === 'string' ? (
      <img
        src={src}
        alt={alt || '题目图示'}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    ) : null,
};

export function StatementMarkdown({ body }: { body: string }) {
  return (
    <article className="cs-statement-markdown">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </Markdown>
    </article>
  );
}
