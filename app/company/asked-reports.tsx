import { levelOf, problemAppHref } from '@/lib/classic-lists';
import { problemTitle } from '@/lib/problems';
import { companyReports, publicCatalogue, REPORT_MONTHS } from '@/lib/server/learner-cloud';

const SHOWN = 10;

/** Company page: problems learners reported being asked here lately ("I was asked this"). */
export async function CompanyAsked({ slug, zh }: { slug: string; zh: boolean }) {
  const reports = companyReports(slug);
  if (!reports.length) return null;
  const catalogue = await publicCatalogue().catch(() => null);
  const shown = reports.filter((r) => catalogue?.has(r.problemId)).slice(0, SHOWN);
  if (!shown.length) return null;
  return (
    <section className="company-hub-section" aria-labelledby="asked">
      <div className="company-hub-section-head">
        <h2 id="asked">
          {zh ? '学员最近被问' : 'Recently asked, as learners report'}{' '}
          <small>{zh ? `近 ${REPORT_MONTHS} 个月，按报告人数` : `last ${REPORT_MONTHS} months, by learners`}</small>
        </h2>
      </div>
      <ol className="company-hub-lc">
        {shown.map((r, index) => {
          const p = catalogue!.get(r.problemId)!;
          const level = levelOf(p.difficulty);
          return (
            <li key={r.problemId}>
              <a href={problemAppHref(r.problemId)}>
                <span className="company-hub-rank" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="company-hub-lc-title">
                  <span className="oa-public-number">{r.problemId.startsWith('lc-') ? `LC ${r.problemId.slice(3)}` : 'OA'}</span>{' '}
                  {problemTitle(p)}
                </span>
                <span className="company-hub-freq">
                  {zh ? `最近被问 ${r.n} 次 · ${r.last}` : `Asked ${r.n}× · ${r.last}`}
                </span>
                <span className="oa-public-chip" data-level={level?.[0]}>
                  {level ? (zh ? level[1] : level[2]) : ''}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
