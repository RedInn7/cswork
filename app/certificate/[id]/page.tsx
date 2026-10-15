import '../certificate.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { seoMetadata } from '@/lib/seo';
import { certificateById } from '@/lib/server/certificates';
import { requestLocale } from '@/lib/server/locale';
import { CertificateView } from '../view';

type Props = { params: Promise<{ id: string }> };

/** Malformed and unknown ids are the same plain 404. */
const load = cache(async (id: string) => {
  const zh = (await requestLocale()) === 'zh';
  const cert = certificateById(id, zh);
  if (!cert) notFound();
  return { cert, zh };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cert, zh } = await load((await params).id);
  return {
    ...seoMetadata({
      title: zh
        ? `${cert.skill ? '技能认证' : '结业证书'}：${cert.course} · CSWork`
        : `${cert.skill ? 'Skill certificate' : 'Certificate'}: ${cert.course} · CSWork`,
      description: zh
        ? `CSWork ${cert.skill ? '技能认证' : '课程'}「${cert.course}」的${cert.skill ? '站内证书' : '结业证书'}，验证编号 ${cert.id}。`
        : `CSWork ${cert.skill ? 'skill certificate' : 'certificate of completion'} for "${cert.course}", verification ID ${cert.id}.`,
      path: `/certificate/${cert.id}`,
    }),
    // A personal page: shared by its owner, never indexed.
    robots: { index: false, follow: false },
  };
}

export default async function CertificatePage({ params }: Props) {
  const { cert, zh } = await load((await params).id);
  return (
    <div className="certificate-page" lang={zh ? 'zh-CN' : 'en'}>
      <header className="certificate-top">
        <Link href="/" prefetch={false}>
          cswork<span> / {zh ? '证书' : 'certificates'}</span>
        </Link>
        <Link href="/?view=courses" prefetch={false}>
          {zh ? '浏览课程' : 'Browse courses'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main id="main-content">
        <CertificateView cert={cert} zh={zh} />
      </main>
    </div>
  );
}
