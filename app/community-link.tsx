import { setting } from '@/lib/server/env';

/** An https address only: COMMUNITY_URL is a Discord invite or a WeChat group QR image. */
export function communityUrl() {
  try {
    const url = new URL(setting('COMMUNITY_URL'));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** The footers' "join the community" link; nothing when COMMUNITY_URL is unset. */
export function JoinCommunity({ zh }: { zh: boolean }) {
  const href = communityUrl();
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {zh ? '加入社区' : 'Join the community'}
      <span className="sr-only">{zh ? '（在新窗口打开）' : ' (opens in a new tab)'}</span>
    </a>
  ) : null;
}
