// The public certificate (/certificate/<id>), locale-free so tests can render it.
import { SITE_URL } from '@/lib/seo';
import type { certificateById } from '@/lib/server/certificates';
import { CertificateActions } from './actions';

export type CertificateData = NonNullable<ReturnType<typeof certificateById>>;

export function certificateDate(issuedAt: number, zh: boolean) {
  return new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(issuedAt);
}

/**
 * LinkedIn's "Add licence or certification" form filled in (for the holder) and the share links.
 * Plain links: nothing goes to LinkedIn or X until the reader clicks one.
 */
export function shareLinks(cert: CertificateData, zh: boolean) {
  const url = `${SITE_URL}/certificate/${cert.id}`;
  const issued = new Date(cert.issuedAt);
  const text = cert.skill
    ? zh
      ? `我通过了 CSWork 技能认证「${cert.course}」`
      : `I passed the CSWork skill certification “${cert.course}”`
    : zh
      ? `我完成了 CSWork 课程「${cert.course}」`
      : `I completed the CSWork course “${cert.course}”`;
  return {
    addToProfile: `https://www.linkedin.com/profile/add?${new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: cert.course,
      organizationName: 'CSWork',
      issueYear: String(issued.getUTCFullYear()),
      issueMonth: String(issued.getUTCMonth() + 1),
      certUrl: url,
      certId: cert.id,
    })}`,
    linkedIn: `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}`,
    x: `https://x.com/intent/tweet?${new URLSearchParams({ text, url })}`,
  };
}

/** `owner`: the holder is reading, so the add-to-LinkedIn-profile link shows. */
export function CertificateView({ cert, zh, owner = false }: { cert: CertificateData; zh: boolean; owner?: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const url = `${SITE_URL}/certificate/${cert.id}`;
  const share = shareLinks(cert, zh);
  const date = certificateDate(cert.issuedAt, zh);
  return (
    <>
      <article className="certificate-sheet" aria-labelledby="certificate-title">
        <p className="certificate-mark" aria-hidden="true">
          cs<span>work</span>
        </p>
        <h1 id="certificate-title">
          <span className="certificate-kicker">
            {cert.skill ? t('技能认证', 'Skill certification') : t('结业证书', 'Certificate of completion')}
          </span>
          <span className="certificate-name">{cert.name || (cert.handle ? `@${cert.handle}` : t('CSWork 学员', 'A CSWork learner'))}</span>
        </h1>
        <p className="certificate-line">
          {cert.skill
            ? t('通过了 CSWork 站内限时认证考试', 'has passed the CSWork timed certification exam')
            : t('已完成课程的全部章节', 'has completed every lesson of')}
        </p>
        <p className="certificate-course">{cert.course}</p>
        <dl className="certificate-facts">
          <div>
            <dt>{cert.skill ? t('通过日期', 'Passed') : t('完成日期', 'Completed')}</dt>
            <dd>
              <time dateTime={new Date(cert.issuedAt).toISOString()}>{date}</time>
            </dd>
          </div>
          {!cert.skill && (
            <div>
              <dt>{t('章节', 'Lessons')}</dt>
              <dd>{cert.lessons}</dd>
            </div>
          )}
          <div>
            <dt>{t('验证编号', 'Verification ID')}</dt>
            <dd className="certificate-id">{cert.id}</dd>
          </div>
        </dl>
        <p className="certificate-verify">
          {t('在线验证：', 'Verify online: ')}
          <a href={`/certificate/${cert.id}`}>{url.replace(/^https:\/\//, '')}</a>
        </p>
        {cert.handle && (
          <p className="certificate-profile">
            <a href={`/u/${cert.handle}`}>{t(`查看 @${cert.handle} 的学习主页`, `See @${cert.handle}’s learner profile`)}</a>
          </p>
        )}
      </article>
      <CertificateActions url={url} zh={zh} />
      <nav className="certificate-share" aria-label={t('分享证书', 'Share this certificate')}>
        {owner && (
          <a href={share.addToProfile} target="_blank" rel="noopener noreferrer">
            {t('添加到 LinkedIn 资料', 'Add to LinkedIn profile')}
          </a>
        )}
        <a href={share.linkedIn} target="_blank" rel="noopener noreferrer">
          {t('分享到 LinkedIn', 'Share on LinkedIn')}
        </a>
        <a href={share.x} target="_blank" rel="noopener noreferrer">
          {t('分享到 X', 'Share on X')}
        </a>
      </nav>
      <p className="certificate-note">
        {cert.skill
          ? t(
              '这是 CSWork 站内认证：学员在本站限时考试中，总分达到 70% 且每题不低于 40% 时自动签发。它记录本站的考试成绩，不代表任何学历或职业资格。',
              'This is a CSWork site certification, issued automatically when a learner scores 70% overall and at least 40% on every question of a timed exam on this site. It records that exam result; it is not an academic degree or a professional licence.',
            )
          : t(
              '证书由 CSWork 在学员完成课程全部已发布章节时自动签发，证明课程学习记录，不代表任何学历或职业资格。',
              'CSWork issues this certificate automatically when a learner completes every published lesson of a course. It records course completion; it is not an academic degree or a professional licence.',
            )}
      </p>
    </>
  );
}
