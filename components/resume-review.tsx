'use client';
import { useEffect, useRef, useState } from 'react';
import { ojRequest } from '@/lib/oj-client';
import type { ResumeReview as Review } from '@/lib/server/ai-resume';

// Mirrors lib/server/ai-resume.ts; the server checks again.
const RESUME_MIN = 80;
const RESUME_CHARS = 12_000;

type Reply = { review: Review; remaining: number; limit: number; bonus: number };

/**
 * /career/resume: paste resume text, get structured feedback (lib/server/ai-resume.ts). The
 * text lives only in this page's state: it is not saved in the browser or on the server.
 */
export function ResumeReview({ zh }: { zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [resume, setResume] = useState(''),
    [role, setRole] = useState(''),
    [job, setJob] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [signedOut, setSignedOut] = useState(false),
    [left, setLeft] = useState<number | null>(null),
    [review, setReview] = useState<Review | null>(null);
  const result = useRef<HTMLElement>(null);
  useEffect(() => {
    let live = true;
    ojRequest<Record<string, number>>('ai/usage')
      .then((usage) => live && setLeft((usage.resume ?? 0) + (usage.bonus ?? 0)))
      .catch((e: Error & { status?: number | string }) => {
        if (live && e.status === 401) setSignedOut(true);
      });
    return () => {
      live = false;
    };
  }, []);
  // A new review takes focus, so a screen reader starts reading it.
  useEffect(() => {
    if (review) result.current?.focus();
  }, [review]);
  const length = resume.trim().length;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const reply = await ojRequest<Reply>('ai/resume', { resume, role, job, locale: zh ? 'zh' : 'en' });
      setReview(reply.review);
      setLeft(reply.remaining + (reply.bonus ?? 0));
    } catch (e) {
      const failure = e as Error & { status?: number | string };
      if (failure.status === 401) setSignedOut(true);
      else setError(failure.message);
      if (failure.status === 429) setLeft(0);
    } finally {
      setBusy(false);
    }
  }
  if (signedOut)
    return (
      <div className="resume-off">
        <p>{t('登录后才能使用简历 AI 点评。', 'Sign in to use the AI resume review.')}</p>
        <a href="/?view=account">{t('登录 / 注册', 'Sign in / sign up')} →</a>
      </div>
    );
  return (
    <div className="resume-review">
      <form className="resume-form" onSubmit={submit} aria-describedby="resume-privacy">
        <label htmlFor="resume-text">
          {t('简历文字', 'Resume text')}
          <small id="resume-text-hint">
            {t(
              `从 PDF 或文档里复制全部文字粘贴进来，至少 ${RESUME_MIN} 个字符，最多 ${RESUME_CHARS.toLocaleString()} 个。不支持上传文件。`,
              `Copy all the text from your PDF or document and paste it here: at least ${RESUME_MIN} characters, at most ${RESUME_CHARS.toLocaleString()}. File uploads are not supported.`,
            )}
          </small>
          <textarea
            id="resume-text"
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            maxLength={RESUME_CHARS}
            required
            aria-describedby="resume-text-hint"
            spellCheck={false}
          />
        </label>
        <label htmlFor="resume-role">
          {t('目标岗位', 'Target role')}
          <small>{t('例如：后端实习、应届软件工程师。可不填。', 'For example: backend intern, new-grad software engineer. Optional.')}</small>
          <input id="resume-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
        </label>
        <label htmlFor="resume-job">
          {t('职位描述', 'Job description')}
          <small>{t('贴上职位描述，关键词差距会更准。可不填。', 'Paste the posting for a sharper keyword check. Optional.')}</small>
          <textarea id="resume-job" rows={5} value={job} onChange={(e) => setJob(e.target.value)} maxLength={4000} />
        </label>
        <div className="resume-actions">
          <button type="submit" disabled={busy || length < RESUME_MIN || left === 0}>
            {busy ? t('正在点评…（约 20 秒）', 'Reviewing… (about 20 seconds)') : t('开始点评', 'Review my resume')}
          </button>
          <small aria-live="polite">
            {left === null
              ? ''
              : left > 0
                ? t(`今天还可以点评 ${left} 次`, `${left} ${left === 1 ? 'review' : 'reviews'} left today`)
                : t('今天的次数已用完，明天再来', "You've used today's reviews. Come back tomorrow")}
          </small>
        </div>
        {error && (
          <p className="resume-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {review && (
        <section className="resume-result" ref={result} tabIndex={-1} aria-labelledby="resume-result-title">
          <h2 id="resume-result-title">{t('点评结果', 'Your review')}</h2>
          {review.summary && <p className="resume-summary">{review.summary}</p>}
          {review.impact.length > 0 && (
            <div>
              <h3>{t('成果量化', 'Impact and numbers')}</h3>
              <ul>
                {review.impact.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {review.verbs.length > 0 && (
            <div>
              <h3>{t('动词', 'Verbs')}</h3>
              <ul>
                {review.verbs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {review.keywords.missing.length + review.keywords.present.length > 0 && (
            <div>
              <h3>{t('关键词（ATS）', 'Keywords (ATS)')}</h3>
              {review.keywords.missing.length > 0 && (
                <>
                  <p>{t('目标岗位提到、简历里没有：', 'Asked for by the role, missing from the resume:')}</p>
                  <ul className="resume-keywords is-missing">
                    {review.keywords.missing.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </>
              )}
              {review.keywords.present.length > 0 && (
                <>
                  <p>{t('已经覆盖：', 'Already covered:')}</p>
                  <ul className="resume-keywords is-present">
                    {review.keywords.present.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {review.rewrites.length > 0 && (
            <div>
              <h3>{t('逐条改写建议', 'Rewrites, line by line')}</h3>
              <ol className="resume-rewrites">
                {review.rewrites.map((r) => (
                  <li key={r.before}>
                    <span>
                      <span className="sr-only">{t('原文：', 'Before: ')}</span>
                      <del>{r.before}</del>
                    </span>
                    <span>
                      <span className="sr-only">{t('改写：', 'After: ')}</span>
                      <ins>{r.after}</ins>
                    </span>
                    {r.why && <small>{r.why}</small>}
                  </li>
                ))}
              </ol>
              <p>
                {t(
                  '方括号里的 [X%]、[N] 是占位符：只填你能证实的真实数字。',
                  'Brackets such as [X%] and [N] are placeholders: fill in only numbers you can back up.',
                )}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
