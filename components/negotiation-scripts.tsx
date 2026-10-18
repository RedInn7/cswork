'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { SCRIPTS, walk, type Setting } from '@/lib/content/negotiation-scripts';
import '@/app/career-negotiation.css';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
const OFFER_ROWS = [
  ['base', '年薪 base', 'Base salary'],
  ['bonus', '年度目标奖金', 'Annual target bonus'],
  ['equity', '四年股票', 'Stock over 4 years'],
  ['signOn', '签字费', 'Sign-on bonus'],
] as const;
const KIND_NAMES = { recruiter: ['招聘方初筛', 'Recruiter screen'], negotiation: ['Offer 谈判', 'Offer negotiation'] } as const;

/**
 * /career/negotiation: branching recruiter-screen and offer scripts, no AI. Scores stay hidden
 * until the end; state lives here only (nothing saved). `settings` (by scenario id) comes from the
 * server, so the company's floor never reaches the browser.
 */
export function NegotiationScripts({ zh, settings }: { zh: boolean; settings: Record<string, Setting> }) {
  const t = (cn: string, en: string) => (zh ? cn : en);
  const i = zh ? 0 : 1;
  const [id, setId] = useState<string | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const acted = useRef(false);
  useEffect(() => {
    // ?s=<id> opens a script directly.
    const wanted = new URLSearchParams(location.search).get('s');
    if (SCRIPTS.some((s) => s.id === wanted)) setId(wanted);
  }, []);
  useEffect(() => {
    if (acted.current) heading.current?.focus();
  }, [id, picks]);
  const open = (next: string | null) => {
    acted.current = true;
    setId(next);
    setPicks([]);
    history.replaceState(null, '', next ? `?s=${next}` : location.pathname);
  };
  const pick = (n: number) => {
    acted.current = true;
    setPicks((p) => [...p, n]);
  };

  const script = SCRIPTS.find((s) => s.id === id);
  if (!script)
    return (
      <div className="negotiation">
        {(['recruiter', 'negotiation'] as const).map((kind, k) => (
          <section key={kind} className="negotiation-group" aria-labelledby={`negotiation-${kind}`}>
            <h2 id={`negotiation-${kind}`} ref={k ? undefined : heading} tabIndex={-1}>
              {KIND_NAMES[kind][i]}
            </h2>
            <ul className="negotiation-list">
              {SCRIPTS.filter((s) => s.kind === kind).map((s) => {
                const setting = settings[s.scenario];
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => open(s.id)}>
                      <strong>{s.title[i]}</strong>
                      {setting && (
                        <span>
                          {setting.company[i]} · {setting.role[i]}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );

  const setting = settings[script.scenario];
  const { steps, at, total, max, ended } = walk(script, picks);
  const pct = max ? total / max : 0;
  return (
    <div className="negotiation">
      <section className="negotiation-setting" aria-labelledby="negotiation-title">
        <p className="negotiation-kind">{KIND_NAMES[script.kind][i]}</p>
        {/* Step 1 focuses the title, so a screen reader starts from the setting and the recruiter's opening line. */}
        <h2 id="negotiation-title" ref={steps.length ? undefined : heading} tabIndex={-1}>
          {script.title[i]}
        </h2>
        {setting && (
          <>
            <dl>
              <dt>{t('公司', 'Company')}</dt>
              <dd>{setting.company[i]}</dd>
              <dt>{t('岗位', 'Role')}</dt>
              <dd>{t(`${setting.role[0]}（${setting.level[0]}）`, `${setting.role[1]} (${setting.level[1]})`)}</dd>
              <dt>{t('地点', 'Location')}</dt>
              <dd>{setting.location[i]}</dd>
            </dl>
            <p>{setting.brief[i]}</p>
            {setting.offer && (
              <table className="negotiation-offer">
                <caption>{t('书面 offer', 'The written offer')}</caption>
                <tbody>
                  {OFFER_ROWS.map(([key, cn, en]) => (
                    <tr key={key}>
                      <th scope="row">{t(cn, en)}</th>
                      <td>{usd(setting.offer![key] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      <div className="negotiation-log" role="log" aria-live="polite" aria-label={t('对话', 'Conversation')}>
        {steps.map(({ node, pick: n }, k) => (
          <Fragment key={k}>
            <p data-who="them">
              <strong>{t('招聘方', 'Recruiter')}</strong>
              {node.line[i]}
            </p>
            <p data-who="you">
              <strong>{t('你', 'You')}</strong>
              {node.choices[n].say[i]}
            </p>
          </Fragment>
        ))}
        <p data-who="them">
          <strong>{t('招聘方', 'Recruiter')}</strong>
          {at.line[i]}
        </p>
      </div>

      {!ended ? (
        <section aria-labelledby="negotiation-reply">
          <h3 id="negotiation-reply" ref={steps.length ? heading : undefined} tabIndex={-1}>
            {t(`第 ${steps.length + 1} 步：你怎么回应？`, `Step ${steps.length + 1}: how do you reply?`)}
          </h3>
          <ol className="negotiation-choices">
            {at.choices.map((c, n) => (
              <li key={n}>
                <button type="button" onClick={() => pick(n)}>
                  {c.say[i]}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="negotiation-result" aria-labelledby="negotiation-score">
          <h3 id="negotiation-score" ref={heading} tabIndex={-1}>
            {t('得分', 'Score')} <span className="negotiation-total">{total} / {max}</span>
          </h3>
          <p className="negotiation-verdict">
            {pct >= 0.85
              ? t('谈得很稳：每一步都在保护自己的利益，又没有伤害关系。', 'Solid: you protected your interests at every step without hurting the relationship.')
              : pct >= 0.6
                ? t('大方向对了，有几步还能更好。看看下面丢分的地方。', 'Mostly right, with a few steps to tighten. See where you lost points below.')
                : t('这几步容易让你少拿钱或者丢掉信任。看完解释再来一遍。', 'Several of these moves can cost you money or trust. Read the explanations and try again.')}
          </p>
          <ol className="negotiation-review">
            {steps.map(({ node, pick: n }, k) => {
              const c = node.choices[n];
              return (
                <li key={k}>
                  <p data-who="them">
                    <strong>{t('招聘方', 'Recruiter')}</strong>
                    {node.line[i]}
                  </p>
                  <p>
                    <strong>{t('你的选择：', 'Your reply: ')}</strong>
                    {c.say[i]} <span className="negotiation-score" data-score={c.score}>{c.score} / 2</span>
                  </p>
                  <p className="negotiation-why">{c.why[i]}</p>
                  <details>
                    <summary>{t('其他回应', 'The other replies')}</summary>
                    <ul>
                      {node.choices.map((o, m) =>
                        m === n ? null : (
                          <li key={m}>
                            <p>
                              {o.say[i]} <span className="negotiation-score" data-score={o.score}>{o.score} / 2</span>
                            </p>
                            <p className="negotiation-why">{o.why[i]}</p>
                          </li>
                        ),
                      )}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ol>
          <p>
            <a href="/english/recruiter">
              {t('练习和招聘方谈时间线与 offer 的英文表达 →', 'Practice the English for timelines and offers with recruiters →')}
            </a>
          </p>
          <div className="resume-actions">
            <button type="button" onClick={() => open(script.id)}>
              {t('重来', 'Start over')}
            </button>
            <button type="button" className="is-quiet" onClick={() => open(null)}>
              {t('换一个剧本', 'Choose another script')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
