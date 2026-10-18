'use client';
import './python-debugger.css';
// The pictures panel draws with the algorithm demos' cells and graph marks; the playground doesn't load them.
import '@/app/algorithm-demo.css';
import { lazy, Suspense, useState } from 'react';
import { Bug } from 'lucide-react';
import { Button } from './ui/button';
import { useT } from '@/lib/i18n';
import type { Language } from '@/lib/problems';
import type { PythonDebuggerProps } from './python-debugger';

function LoadFailed({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <p className="pydbg-only" role="alert">
      {t('调试器没加载出来，刷新页面后再试。', "The debugger didn't load. Reload the page and try again.")}{' '}
      <button type="button" onClick={onClose}>
        {t('知道了', 'OK')}
      </button>
    </p>
  );
}
// Its own chunk: the dialog, the tracer and (on open) Pyodide load only when asked for.
const PythonDebugger = lazy(() =>
  import('./python-debugger').then(
    (m) => ({ default: m.PythonDebugger }),
    () => ({ default: LoadFailed }),
  ),
);

/** "Debug" next to Run: opens the step debugger on this code and input (Python only). */
export function DebugButton({
  language,
  ...request
}: Omit<PythonDebuggerProps, 'onClose'> & { language: Language }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (language !== 'python')
    return <span className="pydbg-only">{t('逐行调试暂只支持 Python', 'Step debugging: Python only')}</span>;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="pydbg-launch"
        aria-haspopup="dialog"
        title={t('在浏览器里逐行运行，看每一步的变量', 'Run line by line in your browser and watch every variable')}
        onClick={() => setOpen(true)}
      >
        <Bug size={14} aria-hidden="true" /> {t('调试', 'Debug')}
      </Button>
      {open && (
        <Suspense fallback={null}>
          <PythonDebugger {...request} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
