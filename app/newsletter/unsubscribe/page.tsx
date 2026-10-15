import { requestLocale } from '@/lib/server/locale';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata = { robots: { index: false, follow: false } };

/**
 * The unsubscribe link in each issue lands here: a button that posts, so mail scanners that
 * open every link never unsubscribe anyone (the List-Unsubscribe header posts directly).
 * ?list=reminders is the daily reminder mail's (lib/server/reminders.ts); &done=1 once it posted.
 */
export default async function UnsubscribePage({ searchParams }: Props) {
  const zh = (await requestLocale()) === 'zh';
  const { token, list, done } = await searchParams;
  const reminders = list === 'reminders';
  // [zh, en] for the weekly, then for the reminder mail.
  const say = (weekly: [string, string], daily: [string, string]) => (reminders ? daily : weekly)[zh ? 0 : 1];
  const valid = typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
  return (
    <article>
      <section className="lists-public-hero newsletter-hero">
        <p className="lists-public-kicker">{say(['CSWork 周报', 'The CSWork weekly'], ['CSWork 学习提醒', 'CSWork reminders'])}</p>
        <h1>{say(['退订周报', 'Unsubscribe'], ['退订提醒邮件', 'Stop reminder emails'])}</h1>
        {reminders && done === '1' ? (
          <p>
            <output>
              {zh
                ? '已退订，不会再收到提醒邮件。站内提醒和推送不受影响，可以在账户页关掉。'
                : 'Done: no more reminder emails. In-app and push reminders are unchanged; turn them off on your account page.'}
            </output>
          </p>
        ) : valid ? (
          <form method="post" action={`/api/newsletter/unsubscribe?token=${token}${reminders ? '&list=reminders' : ''}`}>
            <p>
              {say(
                ['点下面的按钮，就不会再收到周报。', 'Press the button and you won’t get any more issues.'],
                ['点下面的按钮，就不会再收到每日提醒邮件。', 'Press the button and you won’t get any more daily reminder emails.'],
              )}
            </p>
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
