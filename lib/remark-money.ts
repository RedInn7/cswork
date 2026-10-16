type Node = { type: string; value?: string; children?: Node[]; position?: { start: { offset?: number }; end: { offset?: number } } };

/**
 * After remark-math, on members' posts: `$5 和 $10` is money, not math. As in Pandoc, inline math
 * may not start or end with a space nor run into a digit, and such a pair goes back to its source text.
 * ponytail: Markdown inside a reverted pair (`$5 **off**, $10`) stays literal; `\$` always works.
 */
export default function remarkMoney() {
  return (tree: Node, file: { value?: unknown }) => {
    const source = typeof file.value === 'string' ? file.value : '';
    const walk = (node: Node) =>
      node.children?.forEach((child, i, list) => {
        if (child.type !== 'inlineMath') return walk(child);
        const raw = source.slice(child.position?.start.offset ?? 0, child.position?.end.offset ?? 0);
        // `$$ x $$` on one line is display math (inline in remark-math): spaces inside are fine.
        if (!raw.startsWith('$$') && (/^\$\s|\s\$$/.test(raw) || /^\d/.test(list[i + 1]?.value ?? '')))
          list[i] = { type: 'text', value: raw };
      });
    walk(tree);
  };
}
