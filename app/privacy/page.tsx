import type { Metadata } from 'next';
import './privacy.css';
import { PrivacyDocument } from './privacy-document';

export const metadata: Metadata = {
  title: 'Privacy notice · cswork',
  description:
    'Learn how cswork handles course accounts, learning records, private tickets, and payment information, and how to contact us to request data deletion.',
};

export default function PrivacyPage() {
  return <PrivacyDocument />;
}
