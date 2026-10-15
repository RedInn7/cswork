import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * Open Graph cards (the opengraph-image routes): one bilingual 1200×630 card per page, the same
 * for every reader (link previews come from crawlers without the locale cookie).
 *
 * The text is drawn only with the bundled Noto Sans SC subset (public/fonts, scripts/og-font.py).
 * A character outside it would make satori fetch that text from Google Fonts, so every field a
 * learner wrote is checked first and swapped for its handle / English stand-in, and a card that
 * still has one becomes the site card: no name or title ever leaves the server.
 */
export type OgCard = {
  kicker: string;
  title: string;
  lines?: string[];
  stats?: (readonly [label: string, value: string | number])[];
  /** Shown after cswork.org. */
  path?: string;
};

export const OG_SIZE = { width: 1200, height: 630 };
export const SITE_CARD: OgCard = {
  kicker: '北美程序员求职 · SWE interview prep',
  title: 'CSWork',
  lines: ['编程题、OA 真题、面经与系统设计', 'Coding practice, company OAs, interview experiences and system design'],
};

type Font = { name: string; data: Buffer; weight: 400 | 700; style: 'normal' };
// One `fonts` array for the process: satori caches the parsed fonts per array object.
let loaded: { covered: Set<string>; fonts: Font[] } | null = null;
function fonts() {
  const dir = join(process.cwd(), 'public/fonts');
  const font = (weight: 400 | 700): Font => ({
    name: 'Noto Sans SC',
    data: readFileSync(join(dir, `noto-sans-sc-og-${weight}.otf`)),
    weight,
    style: 'normal',
  });
  loaded ??= { covered: new Set(readFileSync(join(dir, 'noto-sans-sc-og.txt'), 'utf8')), fonts: [font(400), font(700)] };
  return loaded;
}

/** Every character is in the bundled subset. */
export function drawable(text: string) {
  const { covered } = fonts();
  for (const char of text) if (!covered.has(char)) return false;
  return true;
}
/** `text` cut to `max` characters, or `instead` when the subset can't draw it. */
export const fit = (text: string, instead: string, max = 40) => {
  const chars = [...text.trim()];
  return chars.length && drawable(text) ? (chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : chars.join('')) : instead;
};
const texts = (c: OgCard) => [c.kicker, c.title, ...(c.lines ?? []), ...(c.stats ?? []).flat().map(String), c.path ?? ''];
/** The card as given when the subset draws all of it, else the site card. */
export const drawableCard = (card: OgCard | null) => (card && texts(card).every(drawable) ? card : SITE_CARD);

const NAVY = '#0e1a2b';
const AMBER = '#ffb23f';
const MUTED = '#b7c3d0';

/** The PNG for `card` (null: the site card); a day in shared caches. */
export function ogImage(card: OgCard | null = null) {
  const c = drawableCard(card);
  const stats = c.stats ?? [];
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 72px 52px',
          borderBottom: `14px solid ${AMBER}`,
          background: NAVY,
          color: '#eef3f8',
          fontFamily: 'Noto Sans SC',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26 }}>
            <div style={{ display: 'flex', color: AMBER, fontWeight: 700 }}>{c.kicker}</div>
            <div style={{ display: 'flex', color: MUTED }}>cswork.org{c.path ?? ''}</div>
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: [...c.title].length > 22 ? 54 : 72, fontWeight: 700, lineHeight: 1.15 }}>
            {c.title}
          </div>
          {(c.lines ?? []).map((line) => (
            <div key={line} style={{ display: 'flex', marginTop: 14, fontSize: 30, color: MUTED }}>
              {line}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex' }}>
            {stats.map(([label, value]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', marginRight: 48 }}>
                <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: AMBER }}>{String(value)}</div>
                <div style={{ display: 'flex', fontSize: 21, color: MUTED }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
            cs<span style={{ color: AMBER }}>work</span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: fonts().fonts,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    },
  );
}

// ---------------------------------------------------------------- the cards

const day = (time: number) => new Date(time).toISOString().slice(0, 10);

/** /u/<handle>: solved by difficulty, the longest streak, the rating when contests are shown. */
export function profileOg(p: {
  handle: string;
  solved: { total: number; easy: number; medium: number; hard: number };
  streak: number;
  rating: number | null;
}): OgCard {
  return {
    kicker: '刷题主页 · Learner profile',
    title: `@${p.handle}`,
    lines: [`已解 ${p.solved.total} 题 · ${p.solved.total} solved`],
    stats: [
      ['简单 Easy', p.solved.easy],
      ['中等 Medium', p.solved.medium],
      ['困难 Hard', p.solved.hard],
      ['最长连续天数 Best streak', p.streak],
      ...(p.rating === null ? [] : [['周赛 Rating', p.rating] as const]),
    ],
    path: `/u/${p.handle}`,
  };
}

type Cert = { id: string; course: string; issuedAt: number; skill: boolean; name: string; handle: string | null };
/** /certificate/<id>: the course (both titles), the holder's account name, the date and the id. */
export function certificateOg(zh: Cert, en: Cert): OgCard {
  const fallback = en.handle ? `@${en.handle}` : 'A CSWork learner';
  const course = fit(zh.course, fit(en.course, 'A CSWork course', 30), 30);
  // From the raw titles: one course table title is both, and a cut heading must not repeat in full.
  const english = zh.course !== en.course && drawable(zh.course) ? fit(en.course, '', 60) : '';
  return {
    kicker: zh.skill ? '技能认证 · Skill certification' : '结业证书 · Certificate of completion',
    title: course,
    lines: [...(english ? [english] : []), fit(zh.name, fallback)],
    stats: [
      ['签发 Issued', day(zh.issuedAt)],
      ['编号 ID', zh.id],
    ],
    path: `/certificate/${zh.id}`,
  };
}

/** /oa/<company>: how many problems, how many judge-ready, and the exam platform. */
export function oaCompanyOg(c: { slug: string; name: string; count: number; ready: number; platform: string | null }): OgCard {
  const name = fit(c.name, c.slug);
  return {
    kicker: 'OA 真题 · Online assessment',
    title: `${name} OA`,
    stats: [
      ['题目 Problems', c.count],
      ['可判 Judge-ready', c.ready],
      ...(c.platform ? [['平台 Platform', fit(c.platform, '—', 20)] as const] : []),
    ],
    path: `/oa/${c.slug}`,
  };
}

/** A rated contest: its title and entrant count, never anyone's place. */
export function contestOg(c: { id: string; zh: string; en: string; entrants: number; startsAt: number }): OgCard {
  return {
    kicker: '比赛 · Contest',
    title: c.zh,
    lines: [c.en],
    stats: [
      ['参赛人数 Entrants', c.entrants],
      ['日期 Date', day(c.startsAt)],
    ],
    path: `/contest/${c.id}`,
  };
}
