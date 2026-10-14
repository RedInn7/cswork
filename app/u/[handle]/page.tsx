import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { seoMetadata } from '@/lib/seo';
import { publicCatalogue, publicProfile } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { ProfileView } from '../views';

type Props = { params: Promise<{ handle: string }> };

/** Off, missing and reserved handles are all a plain 404: nothing says an account exists. */
const load = cache(async (handle: string) => {
  const catalogue = await publicCatalogue();
  const profile = publicProfile(decodeURIComponent(handle).toLowerCase(), catalogue);
  if (!profile) notFound();
  return { profile, catalogue, zh: (await requestLocale()) === 'zh' };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { profile, zh } = await load((await params).handle);
  const { total } = profile.solved;
  return {
    ...seoMetadata({
      title: zh ? `@${profile.handle} 的刷题主页 · CSWork` : `@${profile.handle} on CSWork`,
      description: zh
        ? `@${profile.handle} 在 CSWork 通过了 ${total} 道题。${profile.bio}`
        : `@${profile.handle} has solved ${total} problems on CSWork. ${profile.bio}`,
      path: `/u/${profile.handle}`,
    }),
    // Personal pages stay out of search unless the learner opted in.
    ...(profile.indexable ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function LearnerProfilePage({ params }: Props) {
  return <ProfileView {...await load((await params).handle)} />;
}
