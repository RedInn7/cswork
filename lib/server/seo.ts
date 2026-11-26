import * as OpenCC from 'opencc-js/cn2t';
import { seoMetadata } from '@/lib/seo';
import { requestLanguage, urlLanguage } from './locale';

const traditional = OpenCC.Converter({ from: 'cn', to: 'twp' });

/**
 * lib/seo.ts seoMetadata for the URL being served: its canonical and hreflang carry the URL's
 * language (/en/oa), and a Traditional Chinese page has its title and description converted
 * here, as the body is in the browser (lib/traditional.ts).
 */
export async function pageMetadata(page: Omit<Parameters<typeof seoMetadata>[0], 'language'>) {
  const language = (await urlLanguage()) ?? 'zh';
  // A reader who switched languages on an unprefixed page still gets that language's title.
  const hant = (await requestLanguage()) === 'zh-Hant';
  return seoMetadata({
    ...page,
    title: hant ? traditional(page.title) : page.title,
    description: hant ? traditional(page.description) : page.description,
    language,
  });
}
