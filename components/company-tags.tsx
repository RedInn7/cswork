'use client';

import { useState } from 'react';
import type { CompanyChip } from '@/lib/company-tags';
import type { ReportWindows } from '@/lib/report-windows';
import { companyInitials, companyLogos } from '@/lib/oa-company-brands';

const SHOWN = 6;
const ROUND_ZH: Record<string, string> = {
  'Online Assessment': '在线笔试 OA',
  'HR Screen': 'HR 面',
  'Technical Screen': '技术电面',
  Onsite: '现场面',
};
/** A company's reports by age: [zh, en] and the buckets each part adds up. */
const AGES: [string, string, (keyof ReportWindows)[]][] = [
  ['近 6 月', '≤6 mo', ['m3', 'm6']],
  ['6–12 月', '6–12 mo', ['y1']],
  ['更早', 'older', ['y2', 'older']],
];
const logoOf = (slug: string) =>
  Object.hasOwn(companyLogos, slug) ? companyLogos[slug] : null;

function Logo({ slug, size }: { slug: string; size: number }) {
  const logo = logoOf(slug);
  // oxlint-disable-next-line nextjs/no-img-element -- Small local SVG logos, decorative next to the company name.
  return logo ? <img src={logo} alt="" width={size} height={size} loading="lazy" decoding="async" /> : null;
}

/** "Asked at" chips: interview reports that included this problem. */
export function CompanyTags({ companies, english }: { companies: CompanyChip[]; english: boolean }) {
  const [open, setOpen] = useState(false);
  const t = (zh: string, en: string) => (english ? en : zh);
  const label = t('面试出现过', 'Asked at');
  const more = companies.length - SHOWN;
  return (
    <div className="cs-company-tags">
      <span className="cs-company-tags-label" aria-hidden="true">
        {label}
      </span>
      <ul aria-label={label}>
        {(open ? companies : companies.slice(0, SHOWN)).map((c) => {
          const ages = AGES.flatMap(([zh, en, keys]) => {
            const n = c.windows ? keys.reduce((sum, key) => sum + c.windows![key], 0) : 0;
            return n ? [t(`${zh} ${n}`, `${en} ${n}`)] : [];
          });
          const reports =
            t(
              `${c.count} 次面经报告，最近 ${c.last}`,
              `${c.count} ${c.count === 1 ? 'report' : 'reports'}, latest ${c.last}`,
            ) + (ages.length ? t(`（${ages.join('，')}）`, ` (${ages.join(', ')})`) : '');
          return (
            <li
              key={c.slug}
              className="cs-company-chip"
              title={`${c.rounds.map((r) => (english ? r : ROUND_ZH[r] || r)).join(' · ')} — ${reports}`}
            >
              <Logo slug={c.slug} size={14} />
              <span className="cs-company-name">{c.name}</span>
              {c.oa && (
                <abbr className="cs-company-oa" title={t('在线笔试', 'Online Assessment')}>
                  OA
                </abbr>
              )}
              {/* Compact on screen; the full count and date are read out. */}
              <span className="cs-company-freq" aria-hidden="true">
                ×{c.count} · {c.last.slice(0, 7)}
              </span>
              {ages.map((age) => (
                <span key={age} className="cs-company-age" aria-hidden="true">
                  {age}
                </span>
              ))}
              <span className="sr-only">{t(`（${reports}）`, ` (${reports})`)}</span>
            </li>
          );
        })}
      </ul>
      {more > 0 && (
        <button
          type="button"
          className="cs-company-more"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? t('收起', 'Less') : `+${more}`}
          {!open && <span className="sr-only">{t(' 家公司', ' more companies')}</span>}
        </button>
      )}
    </div>
  );
}

/** Up to two tiny marks for a list row; the names (and report counts) are read out once. */
export function CompanyMarks({
  companies,
  english,
}: {
  companies: { slug: string; name: string; count?: number }[];
  english: boolean;
}) {
  const shown = companies.slice(0, 2);
  const spoken = shown.map((c) =>
    !c.count ? c.name : english ? `${c.name} (${c.count} ${c.count === 1 ? 'report' : 'reports'})` : `${c.name}（${c.count} 次报告）`,
  );
  return (
    <span className="study-companies" title={shown.map((c) => (c.count ? `${c.name} ×${c.count}` : c.name)).join(' · ')}>
      <span className="sr-only">
        {(english ? 'Asked at: ' : '面试出现过：') + spoken.join(english ? ', ' : '、')}
      </span>
      {shown.map((c) => (
        <span key={c.slug} className="study-company" aria-hidden="true">
          {logoOf(c.slug) ? <Logo slug={c.slug} size={12} /> : companyInitials(c.name.split(' / ')[0])}
        </span>
      ))}
    </span>
  );
}
