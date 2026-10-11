import type { Metadata } from 'next';
import { requestLocale } from '@/lib/server/locale';
import './privacy.css';
import { PrivacyDocument } from './privacy-document';

export async function generateMetadata(): Promise<Metadata> {
  return (await requestLocale()) === 'zh'
    ? {
        title: '隐私说明 · cswork',
        description:
          '了解 cswork 如何处理课程账户、学习记录、私密工单与支付信息，以及如何联系我们提出数据删除请求。',
      }
    : {
        title: 'Privacy notice · cswork',
        description:
          'Learn how cswork handles course accounts, learning records, private tickets, and payment information, and how to contact us to request data deletion.',
      };
}

export default function PrivacyPage() {
  return <PrivacyDocument />;
}
