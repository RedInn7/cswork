import Link from 'next/link';
import { EstimationDrill } from '@/components/estimation-drill';
import { SITE_NAME, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { SD_ESTIMATION, sdPath } from '@/lib/server/system-design-course';

const COPY = {
  zh: {
    title: `系统设计容量估算练习：QPS、存储、带宽与机器数 | ${SITE_NAME}`,
    description:
      '10 个常见场景的粗略估算练习：根据日活、读写比、数据大小和保留期，算出平均与峰值 QPS、每年存储、带宽和需要的机器数，误差 30% 以内算对，答完给出分步解法、2 的幂和常见延迟数字。',
    eyebrow: '系统设计 · 练习',
    heading: '先算数，再画图。',
    crumb: '容量估算练习',
    back: '估算方法见第 1 章“粗略估算”一节',
  },
  en: {
    title: `System Design Capacity Estimation Drill: QPS, Storage, Bandwidth, Servers | ${SITE_NAME}`,
    description:
      'Back-of-the-envelope practice on 10 common scenarios: from daily users, read/write ratio, item size and retention, work out average and peak QPS, storage a year, bandwidth and the servers needed. Within 30% counts as right, and every answer comes with the steps, powers of two and latency numbers.',
    eyebrow: 'SYSTEM DESIGN · PRACTICE',
    heading: 'Do the math before the diagram.',
    crumb: 'Estimation drill',
    back: 'The method is in chapter 1, under back-of-the-envelope estimates',
  },
};

export async function generateMetadata() {
  const c = COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: sdPath(SD_ESTIMATION) });
}

export default async function EstimationPage() {
  const zh = (await requestLocale()) === 'zh';
  const c = COPY[zh ? 'zh' : 'en'];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: zh ? '系统设计' : 'System design', path: sdPath() },
            { name: c.crumb, path: sdPath(SD_ESTIMATION) },
          ]),
        }}
      />
      <div className="public-library-intro sd-intro">
        <p className="public-library-eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p>{c.description}</p>
        <p className="sd-total">
          <Link href={sdPath('framework')} prefetch={false}>
            {c.back}
          </Link>
        </p>
      </div>
      <EstimationDrill zh={zh} />
    </>
  );
}
