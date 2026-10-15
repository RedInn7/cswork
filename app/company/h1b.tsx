import { approvalRate, H1B, h1bCompany } from '@/lib/server/h1b';

export const h1bPercent = (rate: number | null) => (rate === null ? '—' : `${(rate * 100).toFixed(1)}%`);
export const h1bCount = (n: number, zh: boolean) => n.toLocaleString(zh ? 'zh-CN' : 'en-US');

/** Source, years and build date under an H-1B table; the caveat comes first. */
export function H1bSource({ zh, data = H1B, className }: { zh: boolean; data?: typeof H1B; className?: string }) {
  const years = data.fiscalYears.length ? `FY${data.fiscalYears[0]}–FY${data.fiscalYears.at(-1)}` : '';
  return (
    <p className={className}>
      {zh
        ? '这是按雇主税号统计的申请数，不是人数，也不代表某个岗位一定提供担保。新雇佣含首次申请、新的兼职雇佣和换雇主，续签含延期、同雇主变更和修改。'
        : 'These are petitions counted by employer tax ID, not people, and they do not mean any given role sponsors. New employment includes new concurrent employment and changes of employer; continuing includes continuations, changes with the same employer and amendments.'}{' '}
      {zh ? '数据来源：' : 'Source: '}
      <a href={data.sourceUrl} rel="noopener noreferrer">
        {data.source}
      </a>
      {years && ` (${years})`}
      {data.updated && (zh ? `，更新于 ${data.updated}。` : `, updated ${data.updated}.`)}
    </p>
  );
}

/** The company page's H-1B section: petitions per fiscal year; nothing when the build has no rows for it. */
export function H1bPanel({ slug, zh, data = H1B }: { slug: string; zh: boolean; data?: typeof H1B }) {
  const c = h1bCompany(slug, data);
  if (!c) return null;
  return (
    <section className="company-hub-section" aria-labelledby="h1b">
      <div className="company-hub-section-head">
        <h2 id="h1b">
          {zh ? 'H-1B 担保记录' : 'H-1B sponsorship'} <small>{zh ? 'USCIS 公开数据' : 'USCIS public data'}</small>
        </h2>
        <a href="/career/h1b">
          {zh ? '各公司对比' : 'Compare companies'} <span aria-hidden="true">→</span>
        </a>
      </div>
      <div className="company-h1b-table" role="region" aria-labelledby="h1b" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">{zh ? '财年' : 'Fiscal year'}</th>
              <th scope="col">{zh ? '新雇佣批准' : 'New: approved'}</th>
              <th scope="col">{zh ? '新雇佣拒签' : 'New: denied'}</th>
              <th scope="col">{zh ? '新雇佣批准率' : 'New: approval rate'}</th>
              <th scope="col">{zh ? '续签批准' : 'Continuing: approved'}</th>
              <th scope="col">{zh ? '续签拒签' : 'Continuing: denied'}</th>
            </tr>
          </thead>
          <tbody>
            {[...c.years].reverse().map((y) => (
              <tr key={y.fy}>
                <th scope="row">FY{y.fy}</th>
                <td>{h1bCount(y.newApproved, zh)}</td>
                <td>{h1bCount(y.newDenied, zh)}</td>
                <td>{h1bPercent(approvalRate(y.newApproved, y.newDenied))}</td>
                <td>{h1bCount(y.contApproved, zh)}</td>
                <td>{h1bCount(y.contDenied, zh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <H1bSource zh={zh} data={data} className="company-h1b-note" />
      {!!c.employers.length && (
        <details className="company-hub-sources company-h1b-employers">
          <summary>{zh ? `计入的雇主名称（${c.employers.length}）` : `Employer names counted (${c.employers.length})`}</summary>
          <ul>
            {c.employers.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
