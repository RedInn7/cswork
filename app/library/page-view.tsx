'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { pageView } from '@/lib/analytics';

/** Owner dashboard page views for /library[/<type>/<slug>] and /oa[/<company>/<id>]. */
export function LibraryPageView() {
  const path = usePathname();
  // Search too: a soft navigation from /library?type=guide to /library keeps the path.
  const search = useSearchParams();
  useEffect(() => {
    const [, view, type, slug] = path.split('/');
    pageView({ view, type: type ?? search.get('type'), slug });
  }, [path, search]);
  return null;
}
