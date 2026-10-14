import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import {
  bookProblemUrl,
  classicList,
  classicListAppHref,
  classicLists,
  leetcodeUrl,
  levelOf,
  problemAppHref,
  problemTitle,
  refLabel,
  sourceUrl,
} from '@/lib/classic-lists';
import { listClassicLibrary } from '@/lib/server/study-library';

type Props = { params: Promise<{ slug: string }> };

/** Unknown lists are a real 404. */
async function load(params: Props['params']) {
  const list = classicList((await params).slug);
  if (!list) notFound();
  return { list, view: listClassicLibrary(list) };
}

function text(
  { list, view }: Awaited<ReturnType<typeof load>>,
  zh: boolean,
) {
  const { total, ready } = view.collection;
  const name = zh ? list.nameZh : list.nameEn;
  return {
    name,
    title: zh
      ? `${name} 题号对照：本站可判 ${ready} / ${total} 题 · CSWork`
      : `${name} mapped to CSWork: ${ready} of ${total} judgeable · CSWork`,
    description: zh
      ? `把 ${name} 的 ${total} 道题按题号对照到 CSWork：${ready} 道可在本站在线判题，其余标为站外并链接到力扣。非官方题单，仅做题号对照。`
      : `${name}'s ${total} problems mapped by number to CSWork: ${ready} can be judged online here, the rest link out to LeetCode. Not an official list.`,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await load(params);
  const { title, description } = text(loaded, (await requestLocale()) === 'zh');
  return seoMetadata({ title, description, path: `/lists/${loaded.list.slug}` });
}

export default async function ClassicListPage({ params }: Props) {
  const loaded = await load(params);
  const { list, view } = loaded;
  const zh = (await requestLocale()) === 'zh';
  const { name, description } = text(loaded, zh);
  const { total, ready, mapped } = view.collection;
  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: zh ? '经典题单' : 'Classic lists', path: '/lists' },
            { name, path: `/lists/${list.slug}` },
          ]),
        }}
      />
      <nav className="lists-public-crumbs" aria-label="Breadcrumb">
        <Link href="/lists" prefetch={false}>
          {zh ? '经典题单' : 'Classic lists'}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{name}</span>
      </nav>
      <section className="lists-public-hero">
        <p className="lists-public-kicker">{zh ? '题号对照' : 'Mapped by number'}</p>
        <h1>{zh ? `${name} 对照` : `${name}, mapped`}</h1>
        <p>{description}</p>
        <div className="lists-public-meter">
          <span>
            <strong>{ready}</strong> / {total}{' '}
            {zh ? '道可在本站判题' : 'judgeable here'}
          </span>
          <span
            className="lists-public-bar"
            style={{ '--frac': total ? ready / total : 0 } as React.CSSProperties}
            aria-hidden="true"
          />
          <span>{zh ? `站外 ${total - ready} 道` : `${total - ready} external`}</span>
          {list.refLabel && (
            <span>
              {zh
                ? `${mapped} / ${total} 道有力扣主站对应题`
                : `${mapped} of ${total} have a LeetCode twin`}
            </span>
          )}
        </div>
        <a className="lists-public-cta" href={classicListAppHref(list.slug)}>
          {zh ? '在题库里按这份题单练习' : 'Practice this list in the bank'} →
        </a>
      </section>
      {view.groups.map((group, index) => (
        <section
          key={`${group.nameEn}-${index}`}
          className="lists-public-group"
          aria-labelledby={`lists-group-${index}`}
        >
          <h2 id={`lists-group-${index}`} className="lists-public-h2">
            {zh ? group.nameZh : group.nameEn}
            <small>
              {zh
                ? `${group.total} 题 · 本站可判 ${group.ready}`
                : `${group.total} problems · ${group.ready} judgeable here`}
            </small>
          </h2>
          <ol className="lists-public-rows" data-book={list.refLabel ? true : undefined}>
            {group.items.map((item) => {
              const level = levelOf(item.difficulty);
              const label = problemTitle(item, !zh);
              return (
                <li key={item.ref ?? item.number}>
                  <span className="lists-public-number">
                    {item.ref ? refLabel(list, item.ref, !zh) : item.number}
                  </span>
                  {item.judgeProblemId ? (
                    <a href={problemAppHref(item.judgeProblemId)}>{label}</a>
                  ) : (
                    <a
                      href={
                        item.refSlug
                          ? bookProblemUrl(item.refSlug)
                          : leetcodeUrl(item.number!, item.slug, !zh)
                      }
                      rel="nofollow noopener noreferrer"
                      target="_blank"
                    >
                      {label}
                      <span className="sr-only">{zh ? '（在新窗口打开）' : ' (opens in a new tab)'}</span>
                    </a>
                  )}
                  <span className="lists-public-tags">
                    {item.ref && item.number !== null && (
                      <span className="lists-public-twin">LeetCode {item.number}</span>
                    )}
                    {item.stop && (
                      <span
                        className="lists-public-stop"
                        title={zh ? `500 路第 ${item.stop.code} 站` : `Line 500, stop ${item.stop.code}`}
                      >
                        <b>{item.stop.code}</b> {zh ? item.stop.nameZh : item.stop.nameEn}
                      </span>
                    )}
                    <span className="lists-public-judge" data-external={item.external || undefined}>
                      {item.external ? (zh ? '站外' : 'External') : zh ? '本站可判' : 'Judgeable'}
                    </span>
                  </span>
                  <span className="lists-public-level" data-level={level?.[0]}>
                    {level ? (zh ? level[1] : level[2]) : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <section className="lists-public-source" aria-labelledby="lists-public-source">
        <h2 id="lists-public-source" className="lists-public-h2">
          {zh ? '题单来源' : 'Where the list comes from'}
        </h2>
        <p>
          {zh
            ? `${name} 由其发布方整理，本页只按题号对照，不是官方页面。原题单：`
            : `${name} is published by its own authors. This page only maps it by problem number and is not official. The original list: `}
          <a href={sourceUrl(list)} rel="nofollow noopener noreferrer" target="_blank">
            {new URL(sourceUrl(list)).hostname}
          </a>
        </p>
      </section>
      <nav className="lists-public-others" aria-label={zh ? '其他题单' : 'Other lists'}>
        <h2 className="lists-public-h2">{zh ? '其他题单' : 'Other lists'}</h2>
        <ul>
          {classicLists
            .filter((other) => other.slug !== list.slug)
            .map((other) => (
              <li key={other.slug}>
                <Link href={`/lists/${other.slug}`} prefetch={false}>
                  {zh ? other.nameZh : other.nameEn}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </article>
  );
}
