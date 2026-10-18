// The template part of /topics/<stop>: the main template, then its common variants (with a
// variant matrix on the stops that have one), each in four languages.
import { SelectionAsk } from '@/components/command-palette';
import { TemplateLangMemory } from '@/components/template-lang-memory';
import {
  TEMPLATE_LANGS,
  matrixFor,
  topicPath,
  variantsFor,
  type TemplateLang,
  type TemplateVariant,
  type VariantMatrix,
} from '@/lib/route-templates';
import { DRIVERS } from '@/lib/route-template-drivers';
import type { TopicPractice } from '@/lib/server/topic-page';
import type { DrillTemplate } from '@/components/template-drill';
import { CodeBlock } from './code-block';
import type { TopicStop } from './stops';

/** One template in four languages, Python open; TemplateLangMemory opens the remembered one. */
function LangGroup({ code, name, label }: { code: Record<TemplateLang, string>; name: string; label: (lang: string) => string }) {
  return (
    <>
      {TEMPLATE_LANGS.map(([lang, title], i) => (
        <details className="topics-code" name={name} data-lang={lang} open={i === 0} key={lang}>
          <summary>{title}</summary>
          <CodeBlock code={code[lang]} lang={lang} label={label(title)} />
        </details>
      ))}
    </>
  );
}

function VariantTable({ matrix, variants, zh }: { matrix: VariantMatrix; variants: TemplateVariant[]; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const name = (id: string) => {
    const v = variants.find((item) => item.id === id);
    return v ? (zh ? v.pattern.zh : v.pattern.en) : t('主模板', 'Main template');
  };
  return (
    <div className="topics-matrix-wrap" role="region" tabIndex={0} aria-labelledby="topic-matrix">
      <table className="topics-matrix">
        <caption id="topic-matrix">
          {t('变体矩阵：每格写的是决定这一格的那一两行代码', 'Variant matrix: each cell shows the line or two that decide it')}
        </caption>
        <thead>
          <tr>
            <td />
            {matrix.cols.map((col) => (
              <th scope="col" key={col.en}>
                {zh ? col.zh : col.en}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row, r) => (
            <tr key={row.en}>
              <th scope="row">{zh ? row.zh : row.en}</th>
              {matrix.cells[r].map((cell, c) => (
                <td key={c}>
                  {'note' in cell ? (
                    <p className="topics-matrix-note">{zh ? cell.note.zh : cell.note.en}</p>
                  ) : (
                    <>
                      <a href={cell.variant === 'main' ? '#topic-template' : `#variant-${cell.variant}`}>{name(cell.variant)}</a>
                      {/* One language shows at a time: CSS keys off the section's data-code-lang. */}
                      {TEMPLATE_LANGS.map(([lang]) => (
                        <code key={lang} data-lang={lang} translate="no">
                          {cell.key[lang]}
                        </code>
                      ))}
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TemplateSection({ stop, zh, practice }: { stop: TopicStop; zh: boolean; practice?: TopicPractice }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const title = zh ? stop.title : stop.titleEn;
  const variants = variantsFor(stop.slug);
  const matrix = matrixFor(stop.slug);
  return (
    <section className="topics-template" aria-labelledby="topic-template">
      <TemplateLangMemory />
      <h2 id="topic-template">{t('模板', 'Template')}</h2>
      <p className="topics-template-lead">
        {t(
          '选一种语言展开。四种写法实现的是同一个模板，每一份都编译运行过，并用测试数据核对了输出。',
          'Open one language. All four implement the same template, and each one is compiled, run and checked against test data.',
        )}
        {practice?.focus &&
          t(`看完用它重写热身题 LC ${practice.focus.number}。`, ` Then rewrite the warm-up, LC ${practice.focus.number}, with it.`)}
      </p>
      <LangGroup code={stop.code} name="topic-code" label={(lang) => t(`${lang} 模板代码`, `${lang} template`)} />
      {variants.length > 0 && (
        <section className="topics-variants" aria-labelledby="topic-variants">
          <h3 id="topic-variants">{t('常见变体', 'Common variants')}</h3>
          <p className="topics-template-lead">
            {t(
              `这一站的题还会用到下面 ${variants.length} 种写法。展开看什么时候换用它，代码同样四种语言都跑过测试。`,
              `Problems at this stop also need the ${variants.length} shapes below. Open one to see when to switch to it; its code is tested in all four languages too.`,
            )}
          </p>
          {matrix && <VariantTable matrix={matrix} variants={variants} zh={zh} />}
          {variants.map((v) => {
            const pattern = zh ? v.pattern.zh : v.pattern.en;
            return (
              <details className="topics-variant" id={`variant-${v.id}`} key={v.id}>
                <summary>
                  <span className="topics-variant-name">{pattern}</span>
                  <span className="topics-complexity">{zh ? v.complexity.zh : v.complexity.en}</span>
                </summary>
                <SelectionAsk
                  className="topics-variant-when"
                  clip={{ target: `clip:topic/${stop.slug}`, title: `${title} · ${pattern}`, href: `${topicPath(stop.slug)}#variant-${v.id}` }}
                >
                  <p>{zh ? v.when.zh : v.when.en}</p>
                </SelectionAsk>
                <LangGroup code={v.code} name={`topic-code-${v.id}`} label={(lang) => t(`${lang} 代码：${pattern}`, `${lang}: ${pattern}`)} />
              </details>
            );
          })}
        </section>
      )}
    </section>
  );
}

/** What the template drills work on: the main template and every variant, with their drivers. */
export const drillTemplates = (stop: TopicStop, zh: boolean): DrillTemplate[] => [
  { id: 'main', label: zh ? '主模板' : 'Main template', code: stop.code, driver: DRIVERS[stop.slug] },
  ...variantsFor(stop.slug).map((v) => ({ id: v.id, label: zh ? v.pattern.zh : v.pattern.en, code: v.code, driver: v.driver })),
];
