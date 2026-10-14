'use client';

import { useState } from 'react';
import type { CompanyTag } from '@/lib/company-tags';
import { companyInitials, companyLogos } from '@/lib/oa-company-brands';

const SHOWN = 6;
const ROUND_ZH: Record<string, string> = {
  'Online Assessment': '在线笔试 OA',
  'HR Screen': 'HR 面',
  'Technical Screen': '技术电面',
  Onsite: '现场面',
};
const logoOf = (slug: string) =>
  Object.hasOwn(companyLogos, slug) ? companyLogos[slug] : null;

function Logo({ slug, size }: { slug: string; size: number }) {
  const logo = logoOf(slug);
  // oxlint-disable-next-line nextjs/no-img-element -- Small local SVG logos, decorative next to the company name.
  return logo ? <img src={logo} alt="" width={size} height={size} loading="lazy" decoding="async" /> : null;
}

/** "Asked at" chips: interview reports that included this problem. */
export function CompanyTags({ companies, english }: { companies: CompanyTag[]; english: boolean }) {
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
        {(open ? companies : companies.slice(0, SHOWN)).map((c) => (
          <li
            key={c.slug}
            className="cs-company-chip"
            title={c.rounds.map((r) => (english ? r : ROUND_ZH[r] || r)).join(' · ')}
          >
            <Logo slug={c.slug} size={14} />
            {c.name}
            {c.oa && (
              <abbr className="cs-company-oa" title={t('在线笔试', 'Online Assessment')}>
                OA
              </abbr>
            )}
          </li>
        ))}
      </ul>
      {more > 0 && (
        <button
          type="button"
          className="cs-company-more"
          aria-expanded={open}
          aria-label={open ? t('收起公司', 'Show fewer companies') : t(`再显示 ${more} 家公司`, `Show ${more} more companies`)}
          onClick={() => setOpen(!open)}
        >
          {open ? t('收起', 'Less') : `+${more}`}
        </button>
      )}
    </div>
  );
}

/** Up to two tiny marks for a list row; the names are read out once. */
export function CompanyMarks({ companies, english }: { companies: { slug: string; name: string }[]; english: boolean }) {
  const shown = companies.slice(0, 2);
  return (
    <span className="study-companies" title={shown.map((c) => c.name).join(' · ')}>
      <span className="sr-only">
        {(english ? 'Asked at: ' : '面试出现过：') + shown.map((c) => c.name).join(english ? ', ' : '、')}
      </span>
      {shown.map((c) => (
        <span key={c.slug} className="study-company" aria-hidden="true">
          {logoOf(c.slug) ? <Logo slug={c.slug} size={12} /> : companyInitials(c.name.split(' / ')[0])}
        </span>
      ))}
    </span>
  );
}
