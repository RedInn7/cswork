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
