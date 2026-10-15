/** Which LeetCode site external problem links open; this browser remembers the choice. */
export type LcSite = 'cn' | 'com';
export const LC_SITE_KEY = 'cswork:lc-site';

/** The saved site, else leetcode.com for English readers and leetcode.cn for Chinese ones. */
export function readLcSite(english: boolean): LcSite {
  try {
    const saved = localStorage.getItem(LC_SITE_KEY);
    if (saved === 'cn' || saved === 'com') return saved;
  } catch {}
  return english ? 'com' : 'cn';
}

export function saveLcSite(site: LcSite) {
  try {
    localStorage.setItem(LC_SITE_KEY, site);
  } catch {}
}
