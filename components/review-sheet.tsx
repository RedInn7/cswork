'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Printer, X } from 'lucide-react';
import { classicList, classicLists, groupEntries } from '@/lib/classic-lists';
import { wikiLinks } from '@/lib/note-meta';
import { metaTitle, type ExportItem } from '@/lib/notes-export';
import { STOP_NAMES } from '@/lib/route-stops';
import type { ReviewSheet as Sheet } from '@/lib/server/note-export';
import { api } from '@/lib/types';
import { exportAll } from './cheatsheet';
import { StatementMarkdown } from './statement-markdown';

type Row = Sheet['rows'][number];
type Kind = 'company' | 'stops' | 'list';
const STOPS = Object.keys(STOP_NAMES);
const MAX_STOPS = 8;
/** About what fits on one A4 page in two 9pt columns. */
const ONE_PAGE = 40;
const problemHref = (id: string) => `/?${new URLSearchParams({ view: 'problem', problem: id })}`;
const stopName = (slug: string, zh: boolean) => STOP_NAMES[slug]?.[zh ? 0 : 1] ?? slug;

/** /review-sheet: the one-page sheet, or with ?view=book the printable review book of every problem note. */
export function ReviewSheet(props: { zh: boolean; book: boolean; by: string; company: string; stops: string; list: string }) {
  return props.book ? <ReviewBook zh={props.zh} by={props.by} /> : <OnePager {...props} />;
}

function PrintButton({ zh }: { zh: boolean }) {
  return (
    <button type="button" className="rs-button is-primary" onClick={() => window.print()}>
      <Printer aria-hidden="true" /> {zh ? '打印 / 存为 PDF' : 'Print / save as PDF'}
    </button>
  );
}

/**
 * Pick a scope (a company, up to 8 Line 500 stops or a classic list), get its rows from
 * GET oj/cheatsheet, drop or reorder them, print on one A4 page.
 */
function OnePager({ zh, company, stops, list }: { zh: boolean; company: string; stops: string; list: string }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [kind, setKind] = useState<Kind>(company ? 'company' : list ? 'list' : 'stops');
  const [companySlug, setCompanySlug] = useState(company);
  const [picked, setPicked] = useState(() => stops.split(',').filter((s) => s in STOP_NAMES).slice(0, MAX_STOPS));
  const [listSlug, setListSlug] = useState(classicList(list)?.slug ?? classicLists[0].slug);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const query: Record<string, string> =
      kind === 'company' ? { company: companySlug.trim().toLowerCase() } : kind === 'stops' ? { stops: picked.join(',') } : { list: listSlug };
    setBusy(true);
    setError('');
    try {
      const next = await api<Sheet>(`oj/cheatsheet?${new URLSearchParams(query)}`);
      setSheet(next);
      setRows(next.rows);
      history.replaceState(null, '', `?${new URLSearchParams(query)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (company || stops || list) void load();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, for the scope the link carried.
  }, []);
  const move = (i: number, by: number) =>
    setRows((list) => {
      const next = [...list];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  const title = !sheet
    ? ''
    : sheet.kind === 'stops'
      ? sheet.stops.map((s) => stopName(s, zh)).join(zh ? '、' : ', ')
      : typeof sheet.name === 'string'
        ? sheet.name
        : (sheet.name?.[zh ? 'zh' : 'en'] ?? '');
  const kinds: [Kind, string, string][] = [
    ['company', '公司', 'Company'],
    ['stops', 'Line 500 站点', 'Line 500 stops'],
    ['list', '经典题单', 'Classic list'],
  ];
  return (
    <div className="rs">
      <form
        className="rs-controls"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <fieldset className="rs-kinds">
          <legend>{t('复习范围', 'Scope')}</legend>
          {kinds.map(([k, a, b]) => (
            <label key={k}>
              <input type="radio" name="rs-kind" checked={kind === k} onChange={() => setKind(k)} /> {t(a, b)}
            </label>
          ))}
        </fieldset>
        {kind === 'company' && (
          <label className="rs-field">
            {t('公司（公司页网址里的名字，如 google）', 'Company (as in its page address, e.g. google)')}
            <input value={companySlug} onChange={(e) => setCompanySlug(e.target.value)} required pattern="[A-Za-z0-9-]+" maxLength={80} />
          </label>
        )}
        {kind === 'stops' && (
          <fieldset className="rs-stops">
            <legend>{t(`选 1 到 ${MAX_STOPS} 站`, `Pick 1 to ${MAX_STOPS} stops`)}</legend>
            {STOPS.map((slug) => (
              <label key={slug}>
                <input
                  type="checkbox"
                  checked={picked.includes(slug)}
                  disabled={!picked.includes(slug) && picked.length >= MAX_STOPS}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, slug] : p.filter((s) => s !== slug)))}
                />
                {stopName(slug, zh)}
              </label>
            ))}
          </fieldset>
        )}
        {kind === 'list' && (
          <label className="rs-field">
            {t('题单', 'Problem list')}
            <select value={listSlug} onChange={(e) => setListSlug(e.target.value)}>
              {classicLists.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {zh ? l.nameZh : l.nameEn}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="rs-button is-primary" disabled={busy || (kind === 'stops' && !picked.length)}>
          {busy ? t('生成中…', 'Building…') : t('生成复习单', 'Build the sheet')}
        </button>
      </form>
      {error && (
        <p className="rs-error" role="alert">
          {error}
        </p>
      )}
      {sheet && (
        <>
          <div className="rs-toolbar">
            <p role="status">
              {t(`${rows.length} 行`, `${rows.length} row${rows.length === 1 ? '' : 's'}`)}
              {sheet.total > sheet.rows.length &&
                t(`（共 ${sheet.total} 道，只列前 ${sheet.rows.length} 道）`, ` (${sheet.total} in all, the first ${sheet.rows.length} listed)`)}
            </p>
            {rows.length > ONE_PAGE && (
              <p className="rs-warn">
                {t(
                  `超过 ${ONE_PAGE} 行，打印出来可能超过一页。可以删掉已经有把握的题。`,
                  `Past ${ONE_PAGE} rows the sheet may run over one page. Drop the ones you are sure of.`,
                )}
              </p>
            )}
            <PrintButton zh={zh} />
          </div>
          <article className="rs-sheet" aria-labelledby="rs-title">
            <header>
              <h2 id="rs-title">{title}</h2>
              <p>
                {t('面试前一页纸', 'One-page review')} · {new Date().toLocaleDateString(zh ? 'zh-CN' : 'en-US')}
              </p>
            </header>
            {rows.length ? (
              <ol className="rs-rows">
                {rows.map((r, i) => {
                  const name = metaTitle(r.id, { title: r.title ?? undefined, titleEn: r.titleEn }, !zh);
                  const gist = r.gist ?? (r.hint && `${t('提示：', 'Hint: ')}${r.hint[zh ? 'zh' : 'en']}`);
                  return (
                    <li key={r.id}>
                      <div className="rs-row-head">
                        <a href={problemHref(r.id)}>
                          <b>{r.id.replace(/^lc-/, '')}</b> {name === r.id ? '' : name}
                        </a>
                        {r.leech && <span className="rs-badge is-leech">{t('顽固', 'Leech')}</span>}
                        {r.confidence && r.confidence <= 2 && (
                          <span className="rs-badge is-shaky">{t(`把握 ${r.confidence}`, `Conf. ${r.confidence}`)}</span>
                        )}
                        {r.marks.includes('redo') && <span className="rs-badge">{t('重做', 'Redo')}</span>}
                        {r.marks.includes('star') && <span className="rs-badge">{t('收藏', 'Starred')}</span>}
                        {r.wrong && <span className="rs-badge">{t('错题', 'Mistake')}</span>}
                      </div>
                      {gist && <p className={r.gist ? undefined : 'rs-hint'}>{gist}</p>}
                      {!!r.tags.length && <p className="rs-tags">{r.tags.map((tag) => `#${tag}`).join(' ')}</p>}
                      <div className="rs-row-tools">
                        <button type="button" disabled={!i} onClick={() => move(i, -1)} aria-label={t(`上移 ${name}`, `Move ${name} up`)}>
                          <ArrowUp aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={i === rows.length - 1}
                          onClick={() => move(i, 1)}
                          aria-label={t(`下移 ${name}`, `Move ${name} down`)}
                        >
                          <ArrowDown aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRows((list) => list.filter((x) => x.id !== r.id))}
                          aria-label={t(`从复习单删掉 ${name}`, `Remove ${name} from the sheet`)}
                        >
                          <X aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="rs-empty">
                {t(
                  '这个范围里还没有你写过笔记、收藏、标了重做或做错的题。',
                  'Nothing in this scope yet: no notes, stars, redo marks or mistakes.',
                )}
              </p>
            )}
            {!!sheet.topics.length && (
              <section className="rs-extra" aria-labelledby="rs-topics">
                <h3 id="rs-topics">{t('套路笔记', 'Pattern notes')}</h3>
                {sheet.topics.map((topic) => (
                  <div key={topic.stop}>
                    <h4>{stopName(topic.stop, zh)}</h4>
                    <p>{topic.text}</p>
                  </div>
                ))}
              </section>
            )}
            {!!sheet.cards.length && (
              <section className="rs-extra" aria-labelledby="rs-cards">
                <h3 id="rs-cards">{t('复习卡片', 'Review cards')}</h3>
                <dl>
                  {sheet.cards.map((card) => (
                    <div key={card.id}>
                      <dt>{card.front}</dt>
                      <dd>{card.back}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </article>
        </>
      )}
    </div>
  );
}

/**
 * Every problem note (GET oj/notes/export?prefix=problem), a chapter per Line 500 stop or per group
 * of a classic list (?by=list:<slug>), each chapter on a new page when printed.
 */
function ReviewBook({ zh, by }: { zh: boolean; by: string }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [items, setItems] = useState<ExportItem[] | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    exportAll({ prefix: 'problem' }, setCount).then(setItems, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  const list = by.startsWith('list:') ? classicList(by.slice(5)) : undefined;
  const chapters = useMemo(() => {
    if (!items) return [];
    const byId = new Map(items.map((item) => [item.target.slice(8), item]));
    if (list)
      return list.groups
        .map((group, i) => ({
          key: `g${i}`,
          title: zh ? group.nameZh : group.nameEn,
          items: groupEntries(group).flatMap((e) => {
            const item = byId.get(e.number ? `lc-${e.number}` : (e.judge ?? ''));
            return item ? [item] : [];
          }),
        }))
        .filter((c) => c.items.length);
    const order = (item: ExportItem) => item.meta?.order ?? Infinity;
    return [...STOPS, '']
      .map((stop) => ({
        key: stop || 'other',
        title: stop ? stopName(stop, zh) : t('其他题目', 'Other problems'),
        items: items.filter((item) => (item.meta?.stop ?? '') === stop).sort((a, b) => order(a) - order(b) || a.target.localeCompare(b.target)),
      }))
      .filter((c) => c.items.length);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- t follows zh.
  }, [items, list, zh]);
  const ways: [string, string][] = [
    ['stop', t('按 Line 500 站', 'By Line 500 stop')],
    ...classicLists.map((l): [string, string] => [`list:${l.slug}`, zh ? l.nameZh : l.nameEn]),
  ];
  return (
    <div className="rs rs-book">
      <div className="rs-controls">
        <nav className="rs-ways" aria-label={t('分章方式', 'Chapters')}>
          {ways.map(([key, label]) => (
            <a key={key} href={`?${new URLSearchParams({ view: 'book', by: key })}`} aria-current={(by || 'stop') === key ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        {items && !!chapters.length && <PrintButton zh={zh} />}
      </div>
      {error ? (
        <p className="rs-error" role="alert">
          {error}
        </p>
      ) : !items ? (
        <p role="status">{t(`正在读取笔记，已读 ${count} 条…`, `Reading your notes, ${count} so far…`)}</p>
      ) : !chapters.length ? (
        <p className="rs-empty">
          {list
            ? t('这个题单里的题还没有笔记。', 'No problem of this list has a note yet.')
            : t('还没有题目笔记。在题目页的「笔记」标签写下思路就会出现在这里。', 'No problem notes yet. Write in a problem’s Notes tab and it shows up here.')}
        </p>
      ) : (
        chapters.map((chapter) => (
          <section key={chapter.key} className="rs-chapter" aria-labelledby={`rs-${chapter.key}`}>
            <h2 id={`rs-${chapter.key}`}>{chapter.title}</h2>
            {chapter.items.map((item) => {
              const id = item.target.slice(8);
              const name = metaTitle(id, item.meta, !zh);
              return (
                <article key={id} className="rs-entry">
                  <h3>
                    <a href={problemHref(id)}>{name === id ? id : `${id.replace(/^lc-/, '')}. ${name}`}</a>
                  </h3>
                  <StatementMarkdown body={wikiLinks(item.body)} className="cs-statement-markdown rs-entry-body" />
                </article>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
