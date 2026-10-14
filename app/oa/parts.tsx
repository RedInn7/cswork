import { companyHue, companyInitials, companyLogos } from '@/lib/oa-company-brands';

/** Server twin of CompanyIdentity's mark: reviewed local logo, else hued initials. */
export function OaCompanyMark({ slug, name }: { slug: string; name: string }) {
  const asset = Object.hasOwn(companyLogos, slug) ? companyLogos[slug] : '';
  return (
    <span className="oa-company-logo" aria-hidden="true">
      {asset ? (
        // oxlint-disable-next-line nextjs/no-img-element -- Small reviewed SVGs served from public/.
        <img src={asset} alt="" width={20} height={20} decoding="async" />
      ) : (
        <span
          className="oa-company-initials"
          style={{ '--oa-hue': companyHue(slug) } as React.CSSProperties}
        >
          {companyInitials(name)}
        </span>
      )}
    </span>
  );
}

const difficulties: Record<string, [level: string, en: string]> = {
  简单: ['easy', 'Easy'],
  中等: ['medium', 'Medium'],
  困难: ['hard', 'Hard'],
};
/** Judge-package difficulty (zh) as a chip; `undefined` for problems not judged yet. */
export function OaDifficulty({
  value,
  locale,
}: {
  value?: string;
  locale: 'zh' | 'en';
}) {
  const known = value && Object.hasOwn(difficulties, value) ? difficulties[value] : null;
  if (!known) return null;
  return (
    <span className="oa-public-chip" data-level={known[0]}>
      {locale === 'zh' ? value : known[1]}
    </span>
  );
}
