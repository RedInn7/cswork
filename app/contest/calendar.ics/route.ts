import { CONTEST_KINDS, contestIcs, STARTER_MINUTES, starterStart, WEEKLY_MINUTES, weeklyStart } from '@/lib/contest';
import { SITE_URL } from '@/lib/seo';

/**
 * /contest/calendar.ics: the weekly and the starter as two events repeating every week, to
 * subscribe to (webcal://). ?lang=en for English titles.
 */
export function GET(request: Request) {
  const zh = new URL(request.url).searchParams.get('lang') !== 'en';
  const url = `${SITE_URL}/contest`;
  const title = (kind: 'weekly' | 'starter') => `CSWork ${CONTEST_KINDS[kind][zh ? 0 : 1]}`;
  return new Response(
    contestIcs(
      [
        { id: 'weekly', start: weeklyStart(1), minutes: WEEKLY_MINUTES, title: title('weekly'), url, recurring: true },
        { id: 'starter', start: starterStart(1), minutes: STARTER_MINUTES, title: title('starter'), url, recurring: true },
      ],
      zh ? 'CSWork 比赛' : 'CSWork contests',
    ),
    {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="cswork-contests.ics"',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
