import { feedLocale, feedResponse, newsletterFeed } from '@/lib/server/feeds';

export async function GET(request: Request) {
  return feedResponse(await newsletterFeed(feedLocale(request)));
}
