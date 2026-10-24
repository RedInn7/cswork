import { notFound } from 'next/navigation';

// ponytail: skill certification taken down 2026-10, code kept; delete this layout to reopen
// (and restore the sitemap/nav entries). Issued certificates (/certificate/<id>) stay verifiable.
export default function CertifyLayout(): never {
  notFound();
}
