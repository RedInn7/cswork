import './offers.css';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { guidePath } from '@/lib/career-guide';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { OfferCompare } from '@/components/offer-compare';

const copy = {
  en: {
    title: 'Offer Comparison Calculator: Four-Year Total Comp · CSWork',
    description:
      'Put two to four job offers side by side: base, bonus, sign-on, equity vesting schedule, cliff, refreshers and stock growth, year by year for four years, with each reply deadline counting down. Pre-tax; stays in your browser.',
    kicker: 'OFFER COMPARISON · STAYS IN YOUR BROWSER',
    h1: 'Compare offers over four years, not one.',
    lead: 'Enter each offer’s numbers and pick how its equity vests. The table adds up every year, so you can see which offer pays more in year 1, which pays more over four years, and when each one needs your answer.',
    noticeTitle: 'Pre-tax, and no tax estimate',
    notice:
      'All figures are pre-tax. Taxes differ a lot by state and by your own situation (residency, visa, filing status), so this page does not estimate them. Use one currency for every offer.',
    whyTitle: 'Why four years',
    why: [
      'Back-loaded vesting: with 5 / 15 / 40 / 40, only a fifth of the grant vests in the first two years. Two offers with the same grant can be far apart in year 1 and year 2.',
      'Sign-on clawbacks: a sign-on bonus usually comes back to the company, in full or pro rata, if you leave within the first year or two. Count it as paid only if you plan to stay.',
      'Refreshers and share-price growth are assumptions, not promises. Set both to 0 to see the part written in the offer letter.',
    ],
    chapter: 'Reading and negotiating an offer: the career guide',
  },
  zh: {
    title: 'Offer 对比计算器：4 年总包逐年对比 · CSWork',
    description:
      '把 2–4 个 offer 放在一起比：基本工资、奖金、签字费、股票归属方式、cliff、refresher 和股价增长，逐年算出 4 年税前总包，并给每个答复截止日倒计时。数据只存在你的浏览器里。',
    kicker: 'OFFER 对比 · 只存在你的浏览器里',
    h1: '比 offer，要看 4 年，不只看第一年。',
    lead: '填上每个 offer 的数字，选好股票的归属方式。下面的表会把每一年加起来：哪个第一年拿得多，哪个 4 年拿得多，各自什么时候要答复，一眼就能看清。',
    noticeTitle: '税前，不估算税',
    notice: '税前；各州和不同身份的税差很大，这里不估算。所有 offer 请用同一种货币填写。',
    whyTitle: '为什么要比 4 年总额',
    why: [
      '后置归属（back-loaded）：按 5 / 15 / 40 / 40 归属时，前两年只拿到授予额的五分之一。授予额相同的两个 offer，第 1、2 年可能差很多。',
      '签字费回收条款：一年或两年内离职，签字费通常要全额或按比例退还。打算待满再把它算进去。',
      'Refresher 和股价增长都是假设，不是承诺。两项都填 0，看到的就是 offer 信里写明的部分。',
    ],
    chapter: '求职指南：读懂和谈 offer',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/career/offers' });
}

/** /career/offers: offers side by side over four years (components/offer-compare.tsx), computed in the browser. */
export default async function OffersPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href={guidePath()}>{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? 'Offer 对比' : 'Offer comparison'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <div className="resume-privacy" role="note">
        <strong>{c.noticeTitle}</strong>
        <p>{c.notice}</p>
      </div>
      <OfferCompare zh={zh} signedIn={!!viewer} />
      <section aria-labelledby="offer-why-title" className="offer-why">
        <h2 id="offer-why-title" className="guide-h2">
          {c.whyTitle}
        </h2>
        <ul>
          {c.why.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>
          <a href={guidePath('offer')}>{c.chapter} →</a>
        </p>
      </section>
    </>
  );
}
