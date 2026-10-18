'use client';

/** The browser's print dialog, which also saves the page as a PDF. */
export function PrintButton({ zh, className }: { zh: boolean; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {zh ? '打印 / 存为 PDF' : 'Print / save as PDF'}
    </button>
  );
}
