'use client';

import React, { Children, isValidElement } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    return <p>{children}</p>;
  },
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
