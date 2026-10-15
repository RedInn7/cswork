import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { ownerHandle, publicCatalogue, publicProfile, publicYear } from '@/lib/server/learner-cloud';
import { profileCertificates } from '@/lib/server/certificates';
import { requestLocale } from '@/lib/server/locale';
import { ProfileView } from '../views';

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Off, missing and reserved handles are all a plain 404: nothing says an account exists. */
const load = cache(async (handle: string) => {
  const catalogue = await publicCatalogue();
  const profile = publicProfile(handle.toLowerCase(), catalogue);
  if (!profile) notFound();
  const zh = (await requestLocale()) === 'zh';
  return { profile, catalogue, certificates: profileCertificates(profile.handle, zh), zh };
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

export default async function LearnerProfilePage({ params, searchParams }: Props) {
  const page = await load((await params).handle);
  // ?year=: one of the years the page lists; anything else shows the last half year.
  const wanted = Number((await searchParams).year);
  const year = page.profile.years.includes(wanted) ? publicYear(page.profile.handle, wanted, page.catalogue) : null;
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <ProfileView
      {...page}
      year={year ? { year: year.year, activity: year.activity } : undefined}
      viewer={viewer ? ownerHandle(viewer.id) : null}
    />
  );
}
