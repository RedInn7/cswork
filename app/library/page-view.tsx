'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { pageView } from '@/lib/analytics';

/** Owner dashboard page views for /library and /library/<type>/<slug>. */
export function LibraryPageView() {
  const path = usePathname();
  useEffect(() => {
    const [, , type, slug] = path.split('/');
    pageView({
      view: 'library',
      type: type ?? new URLSearchParams(location.search).get('type'),
      slug,
    });
  }, [path]);
  return null;
}
