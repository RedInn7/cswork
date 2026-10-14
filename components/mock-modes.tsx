'use client';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import type { Navigate } from './learning';

const MODES: [view: string, zh: string, en: string][] = [
  ['mock', '模拟 OA', 'Mock OA'],
  ['mock-interview', '模拟面试', 'Mock interview'],
  ['mock-peer', '同伴互面', 'Peer interviews'],
];

/** Mock OA | Mock interview | Peer interviews (styles in app/mock-interview.css). */
export function ModeTabs({ navigate, current }: { navigate: Navigate; current: string }) {
  const t = useT();
  // Plain clicks stay in the app; modified clicks open a tab as usual.
  const go = (view: string) => (e: React.MouseEvent) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(view);
  };
  return (
    <nav className="mi-modes mi-noprint" aria-label={t('模拟练习', 'Mock practice')}>
      {MODES.map(([view, zh, en]) => (
        <Link
          key={view}
          href={`/?view=${view}`}
          prefetch={false}
          aria-current={view === current ? 'page' : undefined}
          onClick={go(view)}
        >
          {t(zh, en)}
        </Link>
      ))}
    </nav>
  );
}
