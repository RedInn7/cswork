import { dailyFeed, feedLocale, feedResponse } from '@/lib/server/feeds';

export async function GET(request: Request) {
  return feedResponse(await dailyFeed(feedLocale(request)));
}
