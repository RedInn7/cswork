import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { weeklyTitle } from '@/lib/contest';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { roomView } from '@/lib/server/contests';
import { origin } from '@/lib/server/env';
import { HttpError } from '@/lib/server/http';
import { requestLocale } from '@/lib/server/locale';
import { beijingTime } from '@/components/contest-parts';
import { RoomLive } from '../client';

type Props = { params: Promise<{ id: string }> };

/** A private room someone is not in is the same 404 as a missing one. */
const load = cache(async (id: string) => {
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const view = await roomView(id, viewer).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  return { view, zh: (await requestLocale()) === 'zh' };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { view, zh } = await load((await params).id);
  const title = view.week ? weeklyTitle(view.week, zh) : view.title;
  return {
    ...seoMetadata({
      title: `${title} · cswork`,
      description: zh ? `${title}：题目、计分板与赛后补题。` : `${title}: questions, scoreboard and upsolving.`,
      path: `/contest/${view.id}`,
    }),
    // Rooms are private; only the weekly is a page worth finding.
    ...(view.visibility === 'public' ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function ContestRoomPage({ params }: Props) {
  const { view, zh } = await load((await params).id);
  return <RoomLive initial={view} fallbackStart={beijingTime(view.startsAt, zh)} />;
}
