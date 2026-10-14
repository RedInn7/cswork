'use client';

// Styles: app/sql-result.css, loaded by the problem workspace (SQL problems only open there).
import { useT } from '@/lib/i18n';
import {
  diffSqlResults,
  parseSqlResult,
  sqlCellText,
  type SqlCell,
  type SqlDiffRow,
} from '@/lib/sql-result';

/**
 * The SQL judge's expected and actual result sets as one table, row by row:
 * matching rows plain, missing rows marked −, extra rows +, and a wrong row as
 * its expected and actual lines with the differing cells highlighted. Renders
 * nothing when either side is not a whole result (an error or a cut-off
 * output); the raw text stays available beside it.
 */
export function SqlResultDiff({ expected, actual }: { expected: string; actual: string }) {
  const t = useT();
  const want = parseSqlResult(expected);
  const got = parseSqlResult(actual);
  const rows = want && got ? diffSqlResults(want, got) : null;
  if (!want || !got || !rows) return null;
  const width = Math.max(want.columns, got.columns);
  const count = (kind: SqlDiffRow['kind']) => rows.filter((row) => row.kind === kind).length;
  const [missing, extra, changed] = [count('missing'), count('extra'), count('changed')];
  const line = (
    key: string,
    kind: 'same' | 'missing' | 'extra' | 'expected' | 'actual',
    cells: SqlCell[],
    marks: number[] = [],
    other?: SqlCell[],
  ) => {
    const [sign, label] = {
      same: ['', ''],
      missing: ['−', t('缺少', 'Missing')],
      extra: ['+', t('多出', 'Extra')],
      expected: ['−', t('期望', 'Expected')],
      actual: ['+', t('实际', 'Yours')],
    }[kind];
    return (
      <tr key={key} data-diff={kind === 'same' ? undefined : kind}>
        <th scope="row">
          <span aria-hidden="true">{sign}</span>
          {label && <span className="sr-only">{label}</span>}
        </th>
        {Array.from({ length: width }, (_, c) => {
          const cell = cells[c];
          // Same text, different type ('3' and 3): quote the text.
          const typed =
            !!other && marks.includes(c) && cell !== undefined && sqlCellText(cell) === sqlCellText(other[c]);
          return (
            <td key={c} data-null={cell === null || undefined} data-mark={marks.includes(c) || undefined}>
              {cell === undefined ? '' : sqlCellText(cell, typed)}
            </td>
          );
        })}
      </tr>
    );
  };
  return (
    <figure className="cs-sql-diff">
      <figcaption>
        {t('结果对比', 'Result diff')}
        <span>
          {want.columns !== got.columns
            ? t(
                `列数不同：期望 ${want.columns} 列，实际 ${got.columns} 列`,
                `Column count differs: expected ${want.columns}, got ${got.columns}`,
              )
            : !missing && !extra && !changed
              ? t(`${want.rows.length} 行，结果一致`, `${want.rows.length} rows, identical`)
              : t(
                  `期望 ${want.rows.length} 行，实际 ${got.rows.length} 行：缺少 ${missing}，多出 ${extra}，不同 ${changed}`,
                  `Expected ${want.rows.length} rows, got ${got.rows.length}: ${missing} missing, ${extra} extra, ${changed} different`,
                )}
        </span>
      </figcaption>
      <div className="cs-sql-diff-scroll" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">{t('差异', 'Diff')}</span>
              </th>
              {Array.from({ length: width }, (_, c) => (
                <th key={c} scope="col">
                  {t(`第 ${c + 1} 列`, `Col ${c + 1}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={width + 1}>{t('两边都没有行', 'No rows on either side')}</td>
              </tr>
            ) : (
              rows.flatMap((row, k) =>
                row.kind === 'changed'
                  ? [
                      line(`${k}e`, 'expected', row.expected, row.columns, row.actual),
                      line(`${k}a`, 'actual', row.actual, row.columns, row.expected),
                    ]
                  : [line(String(k), row.kind, row.cells)],
              )
            )}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
