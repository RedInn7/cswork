import { companyFeed, feedLocale, feedResponse } from '@/lib/server/feeds';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const xml = await companyFeed((await context.params).slug, feedLocale(request));
  return xml ? feedResponse(xml) : new Response('Not found', { status: 404 });
}
