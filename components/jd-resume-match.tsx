'use client';
import { useEffect, useMemo, useState } from 'react';
import { extractTerms, mentions } from '@/lib/jd-keywords';
import { normalizeResume, readVersions, RESUME_KEY, type Resume, type ResumeItem } from './resume-builder';

const itemText = (item: ResumeItem) => [item.title, item.subtitle, item.bullets].join('\n');

/**
 * /career/jd: the posting's keywords (lib/jd-keywords.ts) against the resume the builder keeps in
 * this browser, its base or any version: what the resume covers and where, what it misses, and the
 * share matched. Computed here only; nothing is sent, signed in or not.
 */
export function JdResumeMatch({ zh, job }: { zh: boolean; job: string }) {
  const t = (a: string, b: string) => (zh ? a : b);
  // [version name ('' for the base), resume]; null until read from storage after hydration.
  const [resumes, setResumes] = useState<[string, Resume][] | null>(null);
  const [pick, setPick] = useState(0);
  // The page re-renders on every keystroke in the posting box; the terms only change with a new check.
  const terms = useMemo(() => extractTerms(job).sort((a, b) => +(a.importance === 'nice') - +(b.importance === 'nice')), [job]);
  useEffect(() => {
    let base: [string, Resume][] = [];
    try {
      const saved = localStorage.getItem(RESUME_KEY);
      if (saved) base = [['', normalizeResume(JSON.parse(saved))]];
    } catch {
      // Blocked storage or a damaged entry: no base resume.
    }
    // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
    setResumes([...base, ...Object.entries(readVersions())]);
  }, []);
  if (!resumes) return null;
  const resume = resumes[pick]?.[1];
  const places = (term: string, r: Resume) => [
    ...(['experience', 'projects'] as const).flatMap((key) =>
      r[key].filter((item) => mentions(term, itemText(item))).map((item) => item.title.trim() || (key === 'experience' ? t('工作经历', 'Experience') : t('项目', 'Projects'))),
    ),
    ...(mentions(term, r.skills) ? [t('技能', 'Skills')] : []),
    ...(r.education.some((item) => mentions(term, itemText(item))) ? [t('教育经历', 'Education')] : []),
    ...(mentions(term, r.awards) ? [t('奖项与证书', 'Awards')] : []),
  ];
  const rows = resume ? terms.map((hit) => ({ hit, where: places(hit.term, resume) })) : [];
  const found = rows.filter((r) => r.where.length);
  const missing = rows.filter((r) => !r.where.length);
  const must = rows.filter((r) => r.hit.importance === 'must');
  const mustFound = must.filter((r) => r.where.length).length;
  const pct = terms.length ? Math.round((found.length / terms.length) * 100) : 0;
  return (
    <section className="resume-result jd-match" aria-labelledby="jd-match-title">
      <h2 id="jd-match-title">{t('和我的简历比对', 'Compare with my resume')}</h2>
      {!resume ? (
        <p>
          {t('这个浏览器里还没有简历。', 'There is no resume in this browser yet.')}{' '}
          <a href="/career/resume/builder">{t('去简历生成器填写，或粘贴已有的简历', 'Fill one in with the resume builder, or paste yours')} →</a>
        </p>
      ) : (
        <>
          {resumes.length > 1 && (
            <label className="jd-match-pick">
              {t('简历版本', 'Resume version')}
              <select value={pick} onChange={(e) => setPick(Number(e.target.value))}>
                {resumes.map(([name], i) => (
                  <option key={i} value={i}>
                    {name || t('基础版', 'Base resume')}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!terms.length ? (
            <p className="resume-summary">{t('职位描述里没有找到技术关键词。', 'No technical keywords found in this posting.')}</p>
          ) : (
            <>
              <p className="resume-summary">
                {zh ? (
                  <>
                    匹配度 <strong>{pct}%</strong>：职位描述的 {terms.length} 个关键词里，简历写到了 {found.length} 个（必须项 {mustFound}/{must.length}）。
                  </>
                ) : (
                  <>
                    <strong>{pct}%</strong> match: your resume has {found.length} of the posting’s {terms.length} keywords ({mustFound} of{' '}
                    {must.length} required).
                  </>
                )}
              </p>
              {missing.length > 0 && (
                <div>
                  <h3>{t('简历里没有', 'Missing from your resume')}</h3>
                  <ul className="resume-keywords is-missing">
                    {missing.map(({ hit }) => (
                      <li key={hit.term}>
                        {hit.term}
                        {hit.importance === 'nice' && t('（加分）', ' (nice to have)')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {found.length > 0 && (
                <div>
                  <h3>{t('已经写到', 'Already on your resume')}</h3>
                  <ul className="jd-match-found">
                    {found.map(({ hit, where }) => (
                      <li key={hit.term}>
                        <strong>{hit.term}</strong> <small>{[...new Set(where)].join(' · ')}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <small>
            {t(
              '只在这个浏览器里比对，简历和职位描述都不会上传。缺的词如果你确实做过，用职位描述里的原词写进要点或技能；没做过的不要写。',
              'Compared in this browser only: neither the resume nor the posting is uploaded. Add a missing keyword in the posting’s own words only where it is true of you.',
            )}
          </small>
        </>
      )}
    </section>
  );
}
