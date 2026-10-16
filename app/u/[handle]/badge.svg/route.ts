import { publicCatalogue } from '@/lib/server/learner-cloud';
import { badgeSvg, practiceCard } from '@/lib/server/practice-board';

/**
 * /u/<handle>/badge.svg: the README badge (lib/server/practice-board.ts), ?lang=en for English.
 * Hidden, missing and switched-off profiles are a plain 404, as the page is.
 */
export async function GET(request: Request, context: { params: Promise<{ handle: string }> }) {
  const card = practiceCard((await context.params).handle.toLowerCase(), await publicCatalogue());
  // An SVG opened on its own is a document: nothing in it may run or load.
  const headers = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" };
  if (!card) return new Response('Not found', { status: 404, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(badgeSvg(card, new URL(request.url).searchParams.get('lang') !== 'en'), {
    headers: { ...headers, 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
