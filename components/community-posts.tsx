'use client';
import { useLocale } from '@/lib/i18n';
import { SolutionPosts } from './solution-posts';
import '@/app/community-posts.css';

/**
 * Under a library item: comments on an experience, or community answers to an interview
 * question (shown once the learner has tried, like the reference answer). Reads signed out.
 */
export function CommunityPosts({ type, slug, signedIn }: { type: string; slug: string; signedIn: boolean }) {
  const english = useLocale() === 'en';
  const experience = type === 'experience';
  return (
    <section className="ct-community" aria-labelledby="ct-community-title">
      <h2 id="ct-community-title">
        {experience ? (english ? 'Comments' : '评论') : english ? 'Community answers' : '社区回答'}
      </h2>
      <SolutionPosts problemId={`${experience ? 'exp' : 'q'}:${slug}`} english={english} signedIn={signedIn} />
    </section>
  );
}
