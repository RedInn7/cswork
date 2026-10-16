'use client';
import { Fragment, useState } from 'react';
import type { TemplateLang } from '@/lib/route-templates';
import { blankDrill, blankRight, orderDrill, orderRight, sameLine, type Blank } from '@/lib/template-drills';

/**
 * Practice on a topic page's template: put shuffled lines back in order (tap one line, then
 * another, to swap them; no drag and drop, so it works the same on a phone and a keyboard),
 * or fill in blanked-out conditions and return values. Built in the browser from the code the
 * page already shows (lib/template-drills.ts).
 */
export function TemplateDrill({
  code,
  langs,
  zh,
}: {
  code: Record<TemplateLang, string>;
  langs: readonly [TemplateLang, string][];
  zh: boolean;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [lang, setLang] = useState(langs[0][0]);
  const [kind, setKind] = useState<'order' | 'blank'>('order');
  const [seed, setSeed] = useState(1);
  const [order, setOrder] = useState<number[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState(false);
  const [said, setSaid] = useState('');
  const drill = orderDrill(code[lang], lang, seed);
  const blanks = blankDrill(code[lang], lang, seed);
  const now = order ?? drill.start;
  const restart = (next: { lang?: TemplateLang; kind?: 'order' | 'blank'; seed?: number }) => {
    if (next.lang) setLang(next.lang);
    if (next.kind) setKind(next.kind);
    if (next.seed) setSeed(next.seed);
    setOrder(null);
    setPicked(null);
    setTyped({});
    setChecked(false);
    setAnswers(false);
    setSaid('');
  };
  const tap = (i: number) => {
    setChecked(false);
    if (picked === null || picked === i) {
      setPicked(picked === i ? null : i);
      setSaid(picked === i ? '' : t(`已选中第 ${i + 1} 行，再点一行和它交换。`, `Line ${i + 1} picked; tap another line to swap.`));
      return;
    }
    const next = [...now];
    [next[picked], next[i]] = [next[i], next[picked]];
    setOrder(next);
    setPicked(null);
    setSaid(t(`第 ${picked + 1} 行和第 ${i + 1} 行已交换。`, `Swapped lines ${picked + 1} and ${i + 1}.`));
  };
  const off = now.filter((k, i) => !sameLine(drill.lines[k], drill.lines[i])).length;
  const holes = blanks.filter((line): line is Blank => typeof line !== 'string');
  const wrongHoles = holes.filter((b, n) => !blankRight(b, typed[n] ?? '')).length;
  const check = () => {
    setChecked(true);
    setPicked(null);
    if (kind === 'order')
      setSaid(
        orderRight(drill.lines, now)
          ? t('顺序全对。', 'All lines are in order.')
          : t(`还有 ${off} 行不在原位。`, `${off} line${off === 1 ? ' is' : 's are'} still out of place.`),
      );
    else
      setSaid(
        wrongHoles
          ? t(`${holes.length} 个空里还有 ${wrongHoles} 个不对。`, `${wrongHoles} of ${holes.length} blanks are not right yet.`)
          : t('全部填对了。', 'Every blank is right.'),
      );
  };
  const context = (lines: string[], label: string) =>
    lines.some((line) => line.trim()) && (
      <pre className="topics-drill-context" role="region" tabIndex={0} aria-label={label}>
        <code translate="no">{lines.join('\n')}</code>
      </pre>
    );
  return (
    <div className="topics-drill-box">
      <div className="topics-drill-bar">
        <div role="group" aria-label={t('题型', 'Drill')}>
          <button type="button" aria-pressed={kind === 'order'} onClick={() => restart({ kind: 'order' })}>
            {t('排序题', 'Put in order')}
          </button>
          <button type="button" aria-pressed={kind === 'blank'} onClick={() => restart({ kind: 'blank' })}>
            {t('填空题', 'Fill in the blanks')}
          </button>
        </div>
        <div role="group" aria-label={t('语言', 'Language')}>
          {langs.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={lang === value} onClick={() => restart({ lang: value })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {kind === 'order' ? (
        <>
          <p className="topics-drill-help" id="topics-drill-help">
            {t(
              '下面几行被打乱了。点一行选中，再点另一行和它交换，排回模板原来的顺序；缩进是提示。',
              'These lines are shuffled. Tap a line to pick it, then tap another to swap them, until they read as the template does; the indentation is a hint.',
            )}
          </p>
          {context(drill.before, t('前面的代码', 'Code before'))}
          <ol className="topics-drill-lines" aria-describedby="topics-drill-help">
            {now.map((k, i) => {
              const right = sameLine(drill.lines[k], drill.lines[i]);
              return (
                <li key={i}>
                  <button
                    type="button"
                    aria-pressed={picked === i}
                    data-state={checked ? (right ? 'right' : 'wrong') : undefined}
                    onClick={() => tap(i)}
                  >
                    {/* Not by colour alone: a mark, and words for screen readers. */}
                    {checked && (
                      <span className="topics-drill-mark">
                        <span aria-hidden="true">{right ? '✓' : '✗'}</span>
                        <span className="sr-only">{right ? t('位置正确：', 'In place: ') : t('位置不对：', 'Out of place: ')}</span>
                      </span>
                    )}
                    <code translate="no">{drill.lines[k]}</code>
                  </button>
                </li>
              );
            })}
          </ol>
          {context(drill.after, t('后面的代码', 'Code after'))}
        </>
      ) : (
        <>
          <p className="topics-drill-help">
            {t(
              '注释已去掉。把空出来的条件、mid 的算法或返回值填回去；空格不影响判分。',
              'Comments are gone. Fill the blanked conditions, mid computations and return values back in; spacing does not matter.',
            )}
          </p>
          <pre className="topics-drill-code" role="region" tabIndex={0} aria-label={t('填空代码', 'Code with blanks')}>
            <code translate="no">
              {blanks.map((line, i) => {
                if (typeof line === 'string')
                  return (
                    <Fragment key={i}>
                      {i > 0 && '\n'}
                      {line}
                    </Fragment>
                  );
                const n = holes.indexOf(line);
                const right = blankRight(line, typed[n] ?? '');
                return (
                  <Fragment key={i}>
                    {i > 0 && '\n'}
                    {line.before}
                    <input
                      aria-label={t(`第 ${n + 1} 空`, `Blank ${n + 1}`)}
                      value={answers ? line.answer : (typed[n] ?? '')}
                      readOnly={answers}
                      size={Math.max(4, line.answer.length)}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoComplete="off"
                      data-state={checked || answers ? (answers || right ? 'right' : 'wrong') : undefined}
                      aria-invalid={checked && !answers && !right ? true : undefined}
                      onChange={(e) => {
                        setTyped((v) => ({ ...v, [n]: e.target.value }));
                        setChecked(false);
                      }}
                    />
                    {/* Not by the border colour alone, as for the order drill's lines. */}
                    {checked && !answers && (
                      <span className="topics-drill-mark" data-state={right ? 'right' : 'wrong'}>
                        <span aria-hidden="true">{right ? '✓' : '✗'}</span>
                        <span className="sr-only">{right ? t('对', 'right') : t('不对', 'not right')}</span>
                      </span>
                    )}
                    {line.after}
                  </Fragment>
                );
              })}
            </code>
          </pre>
        </>
      )}
      <div className="topics-drill-actions">
        <button type="button" onClick={check}>
          {t('检查', 'Check')}
        </button>
        {kind === 'blank' && (
          <button type="button" className="is-quiet" aria-pressed={answers} onClick={() => setAnswers(!answers)}>
            {t('显示答案', 'Show answers')}
          </button>
        )}
        <button type="button" className="is-quiet" onClick={() => restart({ seed: seed + 1 })}>
          {t('换一题', 'Another one')}
        </button>
        <output aria-live="polite">{said}</output>
      </div>
    </div>
  );
}
