import { requestLocale } from '@/lib/server/locale';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata = { robots: { index: false, follow: false } };

/**
 * The unsubscribe link in each issue lands here: a button that posts, so mail scanners that
 * open every link never unsubscribe anyone (the List-Unsubscribe header posts directly).
 */
export default async function UnsubscribePage({ searchParams }: Props) {
  const zh = (await requestLocale()) === 'zh';
  const token = (await searchParams).token;
  const valid = typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
  return (
    <article>
      <section className="lists-public-hero newsletter-hero">
        <p className="lists-public-kicker">{zh ? 'CSWork 周报' : 'The CSWork weekly'}</p>
        <h1>{zh ? '退订周报' : 'Unsubscribe'}</h1>
        {valid ? (
          <form method="post" action={`/api/newsletter/unsubscribe?token=${token}`}>
            <p>{zh ? '点下面的按钮，就不会再收到周报。' : 'Press the button and you won’t get any more issues.'}</p>
            <button type="submit" className="newsletter-button">
              {zh ? '确认退订' : 'Unsubscribe'}
            </button>
          </form>
        ) : (
          <p>{zh ? '这个退订链接不完整，请从邮件里重新打开。' : 'This unsubscribe link is incomplete. Open it from the email again.'}</p>
        )}
      </section>
    </article>
  );
}
