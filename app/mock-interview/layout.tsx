import '../library/library.css';
import './landing.css';
import Link from 'next/link';

export default function MockInterviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-library" lang="en">
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / mock interview</span>
        </Link>
        <Link href="/?view=mock-interview" prefetch={false}>
          Open the interview room <span aria-hidden="true">↗</span>
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
    </div>
  );
}
