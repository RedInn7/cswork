'use client';
import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * A practice timer of `minutes` that starts on request and is kept in this browser under
 * `storageKey` (the start time), so a reload keeps counting: ICA sets (/oa/ica) and take-homes (/take-home).
 */
export function Countdown({ storageKey, minutes }: { storageKey: string; minutes: number }) {
  const t = useT();
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    try {
      const value = Number(localStorage.getItem(storageKey));
      // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
      if (value > 0) setStarted(value);
    } catch {
      /* Blocked storage: the timer starts fresh. */
    }
  }, [storageKey]);
  useEffect(() => {
    if (!started) return;
    // oxlint-disable-next-line react/react-compiler -- A wall clock, read once the timer runs.
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [started]);

  const left = started ? started + minutes * 60_000 - now : minutes * 60_000;
  function start(reset = false) {
    if (reset && !confirm(t('重新开始计时？', 'Restart the timer?'))) return;
    const at = Date.now();
    try {
      localStorage.setItem(storageKey, String(at));
    } catch {
      /* This visit still counts down. */
    }
    setStarted(at);
  }

  return (
    <div className="ica-timer" role="timer" aria-live="off">
      <Timer size={15} aria-hidden="true" />
      {started ? (
        <>
          <span data-over={left <= 0 || undefined}>{left > 0 ? clock(left) : t('时间到，可以继续练', "Time's up — keep practising")}</span>
          <button type="button" onClick={() => start(true)}>
            {t('重来', 'Restart')}
          </button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => start()}>
          {t(`开始 ${minutes} 分钟计时`, `Start the ${minutes}-minute timer`)}
        </Button>
      )}
    </div>
  );
}
