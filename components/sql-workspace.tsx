'use client';

// Styles: app/sql-result.css, loaded by the problem workspace (SQL problems only open there).
import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { activeStatuses, ojRequest, type OJSubmission } from '@/lib/oj-client';
import { CTE_PREVIEW_ROWS, ctePreview, explainQuery, parsePlan, withClause, type PlanNode } from '@/lib/sql-cte';
import { parseSqlDataset, type SqlColumn } from '@/lib/sql-dataset';
import { parseSqlResult, sqlCellText, type SqlCell } from '@/lib/sql-result';
import type { CodeEditorProps } from './editor';
import { CopyBlock } from './oj-results';

export const SQL_GRID_ROWS = 200;

/** A result or table as a grid: its own horizontal scroll, typed column heads, NULL dimmed. */
export function SqlGrid({ caption, columns, rows }: { caption: string; columns: SqlColumn[]; rows: SqlCell[][] }) {
  const t = useT();
  return (
    <figure className="cs-sql-grid">
      <figcaption>
        <strong>{caption}</strong>
        <span>
          {rows.length > SQL_GRID_ROWS
            ? t(`前 ${SQL_GRID_ROWS} 行，共 ${rows.length} 行`, `First ${SQL_GRID_ROWS} of ${rows.length} rows`)
            : t(`${rows.length} 行`, rows.length === 1 ? '1 row' : `${rows.length} rows`)}
        </span>
      </figcaption>
      <div className="cs-sql-grid-scroll" tabIndex={0} role="region" aria-label={caption}>
        <table>
          <thead>
            <tr>
              {columns.map((column, c) => (
                <th key={c} scope="col" title={column.note}>
                  {column.name}
                  {(column.type || column.pk || column.notNull) && (
                    <small>{[column.type, column.pk && 'PK', column.notNull && 'NN'].filter(Boolean).join(' · ')}</small>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length || 1}>{t('没有行', 'No rows')}</td>
              </tr>
            ) : (
              rows.slice(0, SQL_GRID_ROWS).map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} data-null={cell === null || undefined}>
                      {sqlCellText(cell)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

const numbered = (count: number): SqlColumn[] => Array.from({ length: count }, (_, c) => ({ name: `#${c + 1}` }));

/** A SQL track example: each table and the expected result as grids, the raw text folded away. */
export function SqlSample({ input, expected }: { input: string; expected: string }) {
  const t = useT();
  const data = parseSqlDataset(input);
  const want = parseSqlResult(expected);
  const rawInput = <CopyBlock label={t('输入', 'Input')} value={input} />;
  const rawOutput = <CopyBlock label={t('输出', 'Output')} value={expected} />;
  return (
    <div className="cs-sql-sample">
      {data
        ? data.tables.map((table) => (
            <SqlGrid key={table.name} caption={table.name} columns={table.columns} rows={table.rows} />
          ))
        : rawInput}
      {want ? (
        <SqlGrid caption={t('期望输出', 'Expected output')} columns={numbered(want.columns)} rows={want.rows} />
      ) : (
        rawOutput
      )}
      {(data || want) && (
        <details className="cs-sql-raw">
          <summary>{t('原始 SQL 和输出', 'Raw SQL and output')}</summary>
          {data && rawInput}
          {want && rawOutput}
        </details>
      )}
    </div>
  );
}

type Editor = Parameters<NonNullable<CodeEditorProps['onEditorMount']>>[0];

/** The mounted editor (CodeEditor's onEditorMount) and an insert-at-the-cursor that keeps undo. */
export function useEditorInsert() {
  const editor = useRef<Editor | null>(null);
  const mount = useCallback((instance: Editor) => {
    editor.current = instance;
    return () => {
      if (editor.current === instance) editor.current = null;
    };
  }, []);
  const insert = useCallback((text: string) => {
    const instance = editor.current;
    const selection = instance?.getSelection();
    if (!instance || !selection) return;
    instance.executeEdits('cswork-sql-schema', [{ range: selection, text, forceMoveMarkers: true }]);
    instance.focus();
  }, []);
  return { mount, insert };
}

const SCHEMA_KEY = 'cswork:sql-schema';

/** The tables beside the editor; a table or column name inserts at the cursor. Folded state is remembered. */
export function SqlSchema({ input, onInsert }: { input: string; onInsert: (text: string) => void }) {
  const t = useT();
  const data = useMemo(() => (input ? parseSqlDataset(input) : null), [input]);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(SCHEMA_KEY) === 'closed') setOpen(false);
    } catch {
      /* Storage blocked: open. */
    }
  }, []);
  if (!data) return null;
  return (
    <details
      className="cs-sql-schema"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        try {
          localStorage.setItem(SCHEMA_KEY, next ? 'open' : 'closed');
        } catch {
          /* Storage blocked: this visit only. */
        }
      }}
    >
      <summary>{t('表结构', 'Schema')}</summary>
      <p>{t('点名称插入到光标处', 'Click a name to insert it')}</p>
      <ul>
        {data.tables.map((table) => (
          <li key={table.name}>
            <button type="button" className="cs-sql-schema-table" onClick={() => onInsert(table.name)}>
              {table.name}
            </button>
            <ul>
              {table.columns.map((column) => (
                <li key={column.name} title={column.note}>
                  <button type="button" onClick={() => onInsert(column.name)}>
                    {column.name}
                  </button>
                  <span>
                    {column.type}
                    {column.pk ? ' · PK' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Plan steps worth a second look on big data, and the index lookups that avoid them. */
const planKind = (detail: string) =>
  /^SCAN (?!CONSTANT ROW)/.test(detail) || detail.startsWith('USE TEMP B-TREE')
    ? 'warn'
    : detail.startsWith('SEARCH ')
      ? 'ok'
      : undefined;

/** EXPLAIN QUERY PLAN as a nested list, full scans and temporary B-trees marked. */
export function PlanTree({ plan }: { plan: PlanNode[] }) {
  const t = useT();
  const list = (nodes: PlanNode[]) => (
    <ul>
      {nodes.map((node) => (
        <li key={node.id}>
          <span data-plan={planKind(node.detail)}>{node.detail}</span>
          {node.children.length > 0 && list(node.children)}
        </li>
      ))}
    </ul>
  );
  return (
    <figure className="cs-sql-plan">
      <figcaption>{t('执行计划', 'Query plan')} · EXPLAIN QUERY PLAN</figcaption>
      {list(plan)}
      <p className="cs-sql-plan-legend">
        <span data-plan="warn">SCAN</span>
        {t('：逐行读完整张表（或整个索引）；', ': reads every row of a table (or a whole index). ')}
        <span data-plan="warn">USE TEMP B-TREE</span>
        {t(
          '：为排序、去重或分组临时建一棵 B 树。数据一多，这两步最先变慢。',
          ': builds a temporary B-tree to sort, deduplicate or group. These two slow down first as data grows. ',
        )}
        <span data-plan="ok">SEARCH … USING INDEX</span>
        {t('：借索引直接找到要的行。', ': goes straight to the rows it needs through an index.')}
      </p>
    </figure>
  );
}

type Peek = { cte: string | null } & (
  | { state: 'pending' }
  | { state: 'plan'; plan: PlanNode[] }
  | { state: 'rows'; columns: SqlColumn[]; rows: SqlCell[][] }
  | { state: 'error'; message: string }
);

/**
 * Under a finished SQL submission: its query plan and each CTE's first rows, run
 * on the example's data as unlisted 'sql-peek' runs (no verdict, not an attempt).
 * One at a time; a new one cancels the last.
 */
export function SqlInspect({ problemId, code, stdin }: { problemId: string; code: string; stdin: string }) {
  const t = useT();
  const locale = useLocale();
  const ctes = useMemo(() => withClause(code)?.ctes ?? [], [code]);
  const [peek, setPeek] = useState<Peek | null>(null);
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);
  async function run(cte: string | null) {
    const query = cte === null ? explainQuery(code) : ctePreview(code, cte);
    if (!query) return;
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    setPeek({ cte, state: 'pending' });
    try {
      let item = await ojRequest<OJSubmission>(
        'submissions',
        { problemId, language: 'sql', code: query, mode: 'sql-peek', stdin, idempotencyKey: crypto.randomUUID() },
        controller.signal,
      );
      // Plain polls, like the reference run: the server allows two long polls per learner.
      while (activeStatuses.has(item.status)) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        item = await ojRequest<OJSubmission>(`submissions/${item.id}`, undefined, controller.signal);
      }
      if (controller.signal.aborted) return;
      const out = item.cases?.[0];
      const table = item.status === 'finished' && out ? parseSqlResult(out.stdout ?? '') : null;
      const plan = cte === null ? parsePlan(table) : null;
      if (plan) return setPeek({ cte, state: 'plan', plan });
      if (table && cte !== null) {
        let names: unknown;
        try {
          // The harness's SQL_NAMES line: the last line of stderr.
          names = JSON.parse(out?.stderr?.trim().split('\n').at(-1) ?? '');
        } catch {
          /* Numbered columns. */
        }
        const named =
          Array.isArray(names) && names.length === table.columns && names.every((n) => typeof n === 'string')
            ? (names as string[]).map((name) => ({ name }))
            : numbered(table.columns);
        return setPeek({ cte, state: 'rows', columns: named, rows: table.rows });
      }
      setPeek({
        cte,
        state: 'error',
        message: out?.stderr?.trim() || item.message || t('没有运行成功，请重试。', 'It did not run. Try again.'),
      });
    } catch (error) {
      if (!controller.signal.aborted)
        setPeek({
          cte,
          state: 'error',
          message: locale === 'en' ? englishMessage((error as Error).message) : (error as Error).message,
        });
    }
  }
  return (
    <section className="cs-sql-inspect" aria-label={t('查询分析', 'Query inspector')}>
      <div className="cs-sql-inspect-actions">
        <button type="button" aria-pressed={peek?.cte === null} onClick={() => run(null)}>
          {t('执行计划', 'Query plan')}
        </button>
        {ctes.map((cte) => (
          <button key={cte.name} type="button" aria-pressed={peek?.cte === cte.name} onClick={() => run(cte.name)}>
            CTE <code>{cte.name}</code>
          </button>
        ))}
        <small>
          {t('用这次提交的代码，在当前样例上运行，不算提交', 'Runs this submission’s code on the current example; not an attempt')}
        </small>
      </div>
      <div aria-live="polite">
        {peek?.state === 'pending' && (
          <p className="cs-sql-inspect-note" role="status">
            <LoaderCircle size={14} className="cs-spin" aria-hidden="true" />
            {t('正在运行…', 'Running…')}
          </p>
        )}
        {peek?.state === 'plan' && <PlanTree plan={peek.plan} />}
        {peek?.state === 'rows' && (
          <SqlGrid
            caption={t(`CTE ${peek.cte}（最多 ${CTE_PREVIEW_ROWS} 行）`, `CTE ${peek.cte} (up to ${CTE_PREVIEW_ROWS} rows)`)}
            columns={peek.columns}
            rows={peek.rows}
          />
        )}
        {peek?.state === 'error' && <pre className="cs-sql-inspect-error">{peek.message}</pre>}
      </div>
    </section>
  );
}
