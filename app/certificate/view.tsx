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

export function CertificateView({ cert, zh }: { cert: CertificateData; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const url = `${SITE_URL}/certificate/${cert.id}`;
  const date = certificateDate(cert.issuedAt, zh);
  return (
    <>
      <article className="certificate-sheet" aria-labelledby="certificate-title">
        <p className="certificate-mark" aria-hidden="true">
          cs<span>work</span>
        </p>
        <h1 id="certificate-title">
          <span className="certificate-kicker">{t('结业证书', 'Certificate of completion')}</span>
          <span className="certificate-name">{cert.name || (cert.handle ? `@${cert.handle}` : t('CSWork 学员', 'A CSWork learner'))}</span>
        </h1>
        <p className="certificate-line">
          {t('已完成课程的全部章节', 'has completed every lesson of')}
        </p>
        <p className="certificate-course">{cert.course}</p>
        <dl className="certificate-facts">
          <div>
            <dt>{t('完成日期', 'Completed')}</dt>
            <dd>
              <time dateTime={new Date(cert.issuedAt).toISOString()}>{date}</time>
            </dd>
          </div>
          <div>
            <dt>{t('章节', 'Lessons')}</dt>
            <dd>{cert.lessons}</dd>
          </div>
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
      <p className="certificate-note">
        {t(
          '证书由 CSWork 在学员完成课程全部已发布章节时自动签发，证明课程学习记录，不代表任何学历或职业资格。',
          'CSWork issues this certificate automatically when a learner completes every published lesson of a course. It records course completion; it is not an academic degree or a professional licence.',
        )}
      </p>
    </>
  );
}
