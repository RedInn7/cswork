'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { RESUME_KEY, normalizeResume, resumeText } from './resume-builder';

/** What the server reads of a resume (lib/server/ai-resume.ts RESUME_CHARS). */
const RESUME_CHARS = 12_000;

/**
 * The resume builder's saved resume (components/resume-builder.tsx) as text, without the name and
 * contact line, and without certificate verification links: their public page shows the holder's name.
 */
export function builderResume() {
  try {
    const saved = localStorage.getItem(RESUME_KEY);
    if (!saved) return '';
    const r = normalizeResume(JSON.parse(saved));
    const awards = r.awards.replace(/\s*\((?:https?:\/\/)?cswork\.org\/certificate\/[^)\s]+\)/g, '');
    return resumeText({ ...r, name: '', email: '', phone: '', location: '', links: '', awards }).slice(0, RESUME_CHARS);
  } catch {
    // Blocked storage or a damaged entry: start blank.
    return '';
  }
}

/**
 * The project deep dive's resume (components/mock-interview.tsx), before the first message:
 * the builder's by default, pasted or edited here. It rides with each message and the report.
 */
export function ResumeBox({ value, onChange }: { value: string | undefined; onChange: (value: string) => void }) {
  const t = useT();
  useEffect(() => {
    // Filled once from browser storage after SSR; an emptied box stays empty.
    if (value === undefined) onChange(builderResume());
  }, [value, onChange]);
  return (
    <>
      <label className="mi-notes">
        <span>{t('你的简历：面试官会从里面挑项目追问', 'Your resume: the interviewer picks the project from it')}</span>
        <textarea
          value={value ?? ''}
          maxLength={RESUME_CHARS}
          rows={10}
          aria-describedby="mi-resume-note"
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <p id="mi-resume-note" className="mi-muted">
        {t(
          `默认读取简历生成器里保存的内容（不含姓名和联系方式），也可以粘贴或修改，最多 ${RESUME_CHARS.toLocaleString('en-US')} 个字符。简历只随这场面试的每条消息和最后的评估发给 AI，服务器不保存；面试用不到姓名和联系方式，粘贴前可以删掉。`,
          `Filled from the resume builder (without your name and contact details); paste or edit it here, up to ${RESUME_CHARS.toLocaleString('en-US')} characters. It goes to the AI with each message of this interview and the report, and our server never stores it. The interview doesn't need your name or contact details, so leave them out.`,
        )}{' '}
        <Link href="/career/resume/builder" prefetch={false}>
          {t('打开简历生成器', 'Open the resume builder')}
        </Link>
      </p>
    </>
  );
}
