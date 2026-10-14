import './library.css';
import Link from 'next/link';
import { Suspense } from 'react';
import { LibraryPageView } from './page-view';

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-library" lang="en">
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / library</span>
        </Link>
        <Link href="/?view=problems" prefetch={false}>
          Open practice workspace <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        {children}
      </main>
      <footer className="public-library-footer">
        <Link href="/library" prefetch={false}>
          Browse the library
        </Link>
        <Link href="/privacy" prefetch={false}>
          Privacy
        </Link>
      </footer>
      {/* useSearchParams: no static-render bailout for the rest of the layout. */}
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </div>
  );
}
