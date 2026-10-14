import { companyHue, companyInitials, companyLogos } from '@/lib/oa-company-brands';
import { OA_KIND_NAMES, topicName } from '@/lib/route-stops';

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
/** Difficulty (zh) as a chip, ≈ when it is the AI estimate; nothing when unknown. */
export function OaDifficulty({
  difficulty,
  difficultyEstimated,
  locale,
}: {
  difficulty?: string;
  difficultyEstimated?: boolean;
  locale: 'zh' | 'en';
}) {
  const known =
    difficulty && Object.hasOwn(difficulties, difficulty) ? difficulties[difficulty] : null;
  if (!known) return null;
  const zh = locale === 'zh';
  return (
    <span
      className="oa-public-chip"
      data-level={known[0]}
      title={difficultyEstimated ? (zh ? 'AI 估计的难度' : 'AI-estimated difficulty') : undefined}
    >
      {difficultyEstimated && <span aria-hidden="true">≈</span>}
      {difficultyEstimated && <span className="sr-only">{zh ? '估计' : 'Estimated '}</span>}
      {zh ? difficulty : known[1]}
    </span>
  );
}

/** A problem's AI-estimated topics as plain names, with the concept-question label first. */
export function oaTopicLine(item: { topics: string[]; kind?: string }, zh: boolean) {
  return [
    ...(item.kind && Object.hasOwn(OA_KIND_NAMES, item.kind)
      ? [OA_KIND_NAMES[item.kind][zh ? 0 : 1]]
      : []),
    ...item.topics.map((slug) => topicName(slug, zh)),
  ].join(' · ');
}
