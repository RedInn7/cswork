import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { seoMetadata } from '@/lib/seo';
import { followPeople } from '@/lib/server/follows';
import { requestLocale } from '@/lib/server/locale';
import { FollowListView } from '../../views';

type Props = { params: Promise<{ handle: string }> };

/** A hidden or missing profile is the same 404 as on its page. */
const load = cache(async (handle: string) => {
  const people = followPeople(handle, 'followers');
  if (!people) notFound();
  return { people, zh: (await requestLocale()) === 'zh' };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { people, zh } = await load((await params).handle);
  return {
    ...seoMetadata({
      title: zh ? `@${people.handle} 的关注者 · CSWork` : `People following @${people.handle} · CSWork`,
      description: zh ? `@${people.handle} 在 CSWork 的关注者。` : `Who follows @${people.handle} on CSWork.`,
      path: `/u/${people.handle}/followers`,
    }),
    // Lists of people stay out of search.
    robots: { index: false, follow: false },
  };
}

export default async function FollowersPage({ params }: Props) {
  return <FollowListView {...await load((await params).handle)} which="followers" />;
}
