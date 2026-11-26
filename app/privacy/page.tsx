import type { Metadata } from 'next';
import { requestLocale } from '@/lib/server/locale';
import { pageMetadata } from '@/lib/server/seo';
import './privacy.css';
import { PrivacyDocument } from './privacy-document';

export async function generateMetadata(): Promise<Metadata> {
  return (await requestLocale()) === 'zh'
    ? await pageMetadata({
        title: '隐私说明 · CSWork',
        description:
          '了解 cswork 如何处理课程账户、学习记录与支付信息，以及如何联系我们提出数据删除请求。',
        path: '/privacy',
      })
    : await pageMetadata({
        title: 'Privacy notice · CSWork',
        description:
          'Learn how cswork handles course accounts, learning records, and payment information, and how to contact us to request data deletion.',
        path: '/privacy',
      });
}

export default function PrivacyPage() {
  return <PrivacyDocument />;
}
