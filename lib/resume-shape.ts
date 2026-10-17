// Client- and server-safe: the resume builder's data shape (components/resume-builder.tsx, which is
// 'use client' and re-exports these). Server code that reads a resume (resume review links) and
// other features that write bullets into it import from here.
export type ResumeItem = { title: string; subtitle: string; dates: string; bullets: string };
export type ListKey = 'education' | 'experience' | 'projects';
export type Resume = {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string;
  education: ResumeItem[];
  experience: ResumeItem[];
  projects: ResumeItem[];
  skills: string;
  awards: string;
};

export const ITEMS = 20;
export const blankItem = (): ResumeItem => ({ title: '', subtitle: '', dates: '', bullets: '' });
export const blankResume = (): Resume => ({
  name: '',
  email: '',
  phone: '',
  location: '',
  links: '',
  education: [blankItem()],
  experience: [blankItem()],
  projects: [blankItem()],
  skills: '',
  awards: '',
});

/** Field caps: the form's maxLength and what normalizeResume keeps are one and the same. */
export const MAX: Record<Exclude<keyof Resume, ListKey> | keyof ResumeItem, number> = {
  name: 80,
  email: 120,
  phone: 40,
  location: 80,
  links: 300,
  title: 120,
  subtitle: 160,
  dates: 60,
  bullets: 3000,
  skills: 2000,
  awards: 2000,
};
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
/** Anything (a stored or imported file) as a resume: unknown fields dropped, strings capped. */
export function normalizeResume(raw: unknown): Resume {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const items = (value: unknown) =>
    (Array.isArray(value) ? value : []).slice(0, ITEMS).map((v) => {
      const i = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
      return {
        title: text(i.title, MAX.title),
        subtitle: text(i.subtitle, MAX.subtitle),
        dates: text(i.dates, MAX.dates),
        bullets: text(i.bullets, MAX.bullets),
      };
    });
  return {
    name: text(r.name, MAX.name),
    email: text(r.email, MAX.email),
    phone: text(r.phone, MAX.phone),
    location: text(r.location, MAX.location),
    links: text(r.links, MAX.links),
    education: items(r.education),
    experience: items(r.experience),
    projects: items(r.projects),
    skills: text(r.skills, MAX.skills),
    awards: text(r.awards, MAX.awards),
  };
}

/** A text field's lines without their bullet marks; blank lines dropped. */
export const lines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);

/**
 * A review comment's line (resume review links): a lib/resume-check `where` that holds lines plus
 * the line's index among lines(), e.g. 'experience.0.bullets.2' or 'skills.3'.
 */
const LINE_PATH = /^(?:(education|experience|projects)\.(\d{1,2})\.bullets|(skills|awards))\.(\d{1,3})$/;
const MARK = /^\s*(?:[-•*]\s*)?/;
/** The text of the line at `path`, bullet mark dropped; null when there is no such line. */
export function lineAt(r: Resume, path: string): string | null {
  const m = LINE_PATH.exec(path);
  const value = !m ? undefined : m[1] ? r[m[1] as ListKey][+m[2]]?.bullets : r[m[3] as 'skills' | 'awards'];
  return value === undefined ? null : (lines(value)[+m![4]] ?? null);
}
/** `value` with one line equal to `original` (the `at`-th line, else the first such) rewritten, its mark kept. */
function rewriteIn(value: string, original: string, rewrite: string, at?: number) {
  const rows = value.split('\n');
  const texts = rows.map((row) => lines(row)[0]);
  const i = at === undefined ? texts.indexOf(original) : (texts.flatMap((text, k) => (text === undefined ? [] : [k]))[at] ?? -1);
  if (i < 0 || texts[i] !== original) return null;
  rows[i] = MARK.exec(rows[i])![0] + rewrite;
  return rows.join('\n');
}
/**
 * The resume with a reviewer's rewrite in place of `original`: on the line at `path` if it still
 * reads so, else on the first identical line in the same section (entries and lines move); null
 * when the line was edited since or is gone.
 */
export function applyRewrite(r: Resume, path: string, original: string, rewrite: string): Resume | null {
  const m = LINE_PATH.exec(path);
  if (!m) return null;
  if (!m[1]) {
    const key = m[3] as 'skills' | 'awards';
    const value = rewriteIn(r[key], original, rewrite, +m[4]) ?? rewriteIn(r[key], original, rewrite);
    return value === null ? null : { ...r, [key]: value };
  }
  const key = m[1] as ListKey;
  const tries: [number, number?][] = [[+m[2], +m[4]], ...r[key].map((_, i): [number] => [i])];
  for (const [i, at] of tries) {
    const bullets = r[key][i] && rewriteIn(r[key][i].bullets, original, rewrite, at);
    if (bullets != null) return { ...r, [key]: r[key].map((item, k) => (k === i ? { ...item, bullets } : item)) };
  }
  return null;
}
