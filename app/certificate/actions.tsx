'use client';
import { useState } from 'react';

/** Print (or save as PDF) and copy-link buttons; the rest of the certificate is server-rendered. */
export function CertificateActions({ url, zh }: { url: string; zh: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="certificate-actions">
      <button type="button" onClick={() => window.print()}>
        {zh ? '打印 / 存为 PDF' : 'Print / save as PDF'}
      </button>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard?.writeText(url).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        {zh ? '复制链接' : 'Copy link'}
      </button>
      <span role="status">{copied ? (zh ? '链接已复制' : 'Link copied') : ''}</span>
    </div>
  );
}
