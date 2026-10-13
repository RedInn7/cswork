'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { pageView } from '@/lib/analytics';

/** Owner dashboard page views for /library and /library/<type>/<slug>. */
export function LibraryPageView() {
  const path = usePathname();
  // Search too: a soft navigation from /library?type=guide to /library keeps the path.
  const search = useSearchParams();
  useEffect(() => {
    const [, , type, slug] = path.split('/');
    pageView({ view: 'library', type: type ?? search.get('type'), slug });
  }, [path, search]);
  return null;
}
