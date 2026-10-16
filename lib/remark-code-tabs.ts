import { playgroundLanguage } from './playground-share';
import type { CodeLanguage } from './problems';

type Node = { type: string; lang?: string | null; children?: Node[]; data?: object };

/**
 * Posts: 2–4 fenced blocks in a row, each in a different playground language (```python then
 * ```cpp …), become one group: a div.cs-code-tabs whose data-langs the renderer turns into tabs.
 * A lone block, or a run of one language, stays as written. Top-level blocks only.
 */
export default function remarkCodeTabs() {
  return (tree: Node) => {
    const kids = tree.children ?? [];
    const out: Node[] = [];
    for (let i = 0; i < kids.length; ) {
      const langs: CodeLanguage[] = [];
      for (let j = i; j < kids.length && langs.length < 4; j++) {
        const lang = kids[j].type === 'code' ? playgroundLanguage(kids[j].lang) : null;
        if (!lang || langs.includes(lang)) break;
        langs.push(lang);
      }
      if (langs.length < 2) {
        out.push(kids[i++]);
        continue;
      }
      out.push({
        type: 'codeTabs',
        children: kids.slice(i, i + langs.length),
        data: { hName: 'div', hProperties: { className: ['cs-code-tabs'], dataLangs: langs.join(' ') } },
      });
      i += langs.length;
    }
    tree.children = out;
  };
}
