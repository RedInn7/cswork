import type { Resume, ResumeItem } from '@/components/resume-builder';

/**
 * The resume builder's "paste text" import (components/resume-builder.tsx): a resume copied out
 * of a PDF or a document, read by rules in the browser. Section headings in English or Chinese
 * split it; in a list section a line with a date range or after a run of bullets starts a new
 * entry (unless it reads as the bullet's wrapped tail), its next line is the subtitle, and lines
 * opening with • · ▪ * - are bullets. The first
 * line is the name; email, phone and links come from the lines above the first heading. The
 * learner previews the result before it replaces anything.
 */
type Section = 'education' | 'experience' | 'projects' | 'skills' | 'awards' | 'skip';
const HEADINGS: [RegExp, Section][] = [
  [/^(education|academic background|教育背景|教育经历)$/i, 'education'],
  [
    /^((work|professional|relevant|industry|research|teaching|leadership|volunteer(ing)?)\s+)?(experience|employment)(\s+history)?$|^internships?(\s+experience)?$|^(工作|实习|工作与实习|实习与工作|科研|研究|校园)经[历验]$/i,
    'experience',
  ],
  [/^((personal|selected|academic|technical|course|side)\s+)?projects?(\s+experience)?$|^项目经[历验]$/i, 'projects'],
  [/^((technical|core|relevant)\s+)?skills(\s*(&|and)\s*(tools|technologies|interests))?$|^(专业)?技能(特长|清单)?$/i, 'skills'],
  [
    /^(awards?|honou?rs?|certifications?|achievements)(\s*(&|and|,)\s*(awards?|honou?rs?|certifications?|achievements))*$|^(获奖(经历|情况)?|荣誉(奖项)?|证书|荣誉与奖项|获奖与证书|奖项)$/i,
    'awards',
  ],
  [/^(summary|objective|profile|about( me)?|个人(简介|总结)|自我评价)$/i, 'skip'],
];
// Only as a line of their own: inside an entry, "Activities: ACM club" or "Interests: …" is its text.
// Leadership and activities are entries with roles and dates, kept under experience; the rest has no section.
const LINE_HEADINGS: [RegExp, Section][] = [
  [/^(leadership|activities|extracurriculars?|extracurricular activities|leadership\s*(&|and)\s*activities|校园活动|学生工作|社团经历)$/i, 'experience'],
  [/^(publications?|interests|hobbies|references|论文(发表)?|发表论文|兴趣爱好)$/i, 'skip'],
];

const MONTH = '\\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const SEASON = '\\b(?:spring|summer|fall|autumn|winter)';
const DATE = `(?:(?:${MONTH}|${SEASON})\\s*\\d{4}|(?<!\\d)\\d{4}\\s*[./-]\\s*(?:0?[1-9]|1[0-2])(?!\\d)|(?<!\\d)(?:0?[1-9]|1[0-2])\\s*/\\s*\\d{4}|(?<!\\d)\\d{4}\\s*年(?:\\s*\\d{1,2}\\s*月)?|(?<!\\d)(?:19|20)\\d{2}(?!\\d))`;
const END = `(?:${DATE}|present|current|now|ongoing|today|至今|现在|今)`;
const RANGE = new RegExp(`${DATE}\\s*(?:-|–|—|~|～|to|至|－)\\s*${END}`, 'i');
// A single date only at the end of a line: "Summer 2026", "Expected May 2027".
const SINGLE = new RegExp(`(?:expected\\s+|预计\\s*)?${DATE}(?:\\s*\\(expected\\))?\\s*$`, 'i');
const BULLET = /^\s*(?:[•·▪◦●‣∙]\s*|[-*–]\s+)/;
const SPLIT = /\s*[|｜]\s*|\s{2,}|\t|\s+[–—-]\s+/;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE = /\+?\(?\d[\d\s().-]{7,}\d/;
const LINK = /(?:https?:\/\/)?(?:www\.)?(?:[\w-]+\.)+(?:com|io|dev|me|org|net|app|page|site|ai|co|xyz|cn|edu)(?:\/[^\s|,，]*)?/gi;
const trimSeparators = (s: string) => s.replace(/^[\s|｜,，;–—-]+|[\s|｜,，;–—-]+$/g, '');
const blank = (): ResumeItem => ({ title: '', subtitle: '', dates: '', bullets: '' });

function heading(line: string): { section: Section; rest: string } | null {
  const plain = line.replace(/^[#*_\s]+|[*_\s]+$/g, '').replace(/\s+/g, ' ');
  const whole = plain.replace(/[:：]$/, '');
  for (const [re, section] of [...HEADINGS, ...LINE_HEADINGS]) if (whole.length <= 40 && re.test(whole)) return { section, rest: '' };
  // "Skills: Python, Go" — a heading with its first line after the colon.
  const colon = /^([^:：]{2,30})[:：]\s*(.+)$/.exec(plain);
  if (colon) for (const [re, section] of HEADINGS) if (re.test(colon[1].trim())) return { section, rest: colon[2] };
  return null;
}
/** The line without its date range (or trailing date), and that range. */
function dates(line: string) {
  const found = RANGE.exec(line) ?? SINGLE.exec(line);
  return found ? { rest: trimSeparators(line.replace(found[0], ' ')), dates: found[0].trim() } : { rest: line, dates: '' };
}

export function parseResumeText(text: string): Resume {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const header: string[] = [];
  // An entry collects its bullets in `list` until the end.
  type Entry = ResumeItem & { list: string[] };
  const lists: Record<'education' | 'experience' | 'projects', Entry[]> = { education: [], experience: [], projects: [] };
  const plain: Record<'skills' | 'awards', string[]> = { skills: [], awards: [] };
  let section: Section | null = null;
  let entry: Entry | null = null;
  let lastMarked = false;
  const open = (key: keyof typeof lists) => {
    const fresh: Entry = { ...blank(), list: [] };
    lists[key].push(fresh);
    entry = fresh;
    lastMarked = false;
    return fresh;
  };
  const head = (e: ResumeItem, line: string) => {
    const found = dates(line);
    if (found.dates && !e.dates) e.dates = found.dates;
    const parts = found.rest.split(SPLIT).map(trimSeparators).filter(Boolean);
    if (!e.title) {
      e.title = parts[0] ?? '';
      e.subtitle = parts.slice(1).join(', ');
    } else e.subtitle = [e.subtitle, ...parts].filter(Boolean).join(', ');
  };

  for (const line of lines) {
    const h = heading(line);
    if (h) {
      section = h.section;
      entry = null;
      if (!h.rest) continue;
    }
    const content = h ? h.rest : line;
    if (!section) {
      header.push(content);
      continue;
    }
    if (section === 'skip') continue;
    if (section === 'skills' || section === 'awards') {
      plain[section].push(content.replace(BULLET, '').trim());
      continue;
    }
    const marker = BULLET.exec(content);
    const current = entry as Entry | null;
    if (marker) {
      (current ?? open(section)).list.push(content.slice(marker[0].length).trim());
      lastMarked = true;
      continue;
    }
    const range = dates(content).dates;
    if (!current) head(open(section), content);
    else if (!current.list.length) {
      // Still the entry's header lines: a second date line is the next entry; then the subtitle; then unmarked bullets.
      if (range && current.dates) head(open(section), content);
      else if (!current.subtitle || range) head(current, content);
      else current.list.push(content);
    } else if (lastMarked && !range && (/^[a-z0-9(\p{Script=Han}]/u.test(content) || (!/[.。;；!?！？]$/.test(current.list[current.list.length - 1]) && !SPLIT.test(content)))) {
      // A bullet wrapped onto the next line when it was copied out of a PDF: an entry header has a
      // date or a separator, so an undated, unseparated line after an unfinished bullet goes on it.
      // ponytail: a header with neither (a bare "Google" line) after a bullet with no full stop joins it.
      const sep = /[\p{Script=Han}，、：]$/u.test(current.list[current.list.length - 1]) && /^\p{Script=Han}/u.test(content) ? '' : ' ';
      current.list[current.list.length - 1] += `${sep}${content}`;
    } else if (range || lastMarked) head(open(section), content);
    else current.list.push(content);
  }

  // The header: the name first, then email, phone and links by pattern; a leftover short text segment is the location.
  const segments = header.flatMap((l) => l.split(/\s*[|｜•·]\s*|\s{2,}/)).map(trimSeparators).filter(Boolean);
  const [name = '', ...others] = segments;
  const contact = others.join(' | ');
  const email = EMAIL.exec(contact)?.[0] ?? '';
  const links = [...new Set(contact.replace(EMAIL, ' ').match(LINK) ?? [])];
  const phone = PHONE.exec(links.reduce((s, l) => s.replace(l, ' '), contact.replace(EMAIL, ' ')))?.[0].trim() ?? '';
  const location = others.find((s) => !EMAIL.test(s) && !s.includes(phone || '\0') && !links.some((l) => s.includes(l)) && /\p{L}/u.test(s) && s.length <= 60);
  const items = (key: keyof typeof lists) =>
    lists[key].length ? lists[key].map(({ list, ...item }) => ({ ...item, bullets: list.join('\n') })) : [blank()];
  return {
    name: EMAIL.test(name) || name.length > 80 ? '' : name,
    email,
    phone,
    location: location ?? '',
    links: links.join(', '),
    education: items('education'),
    experience: items('experience'),
    projects: items('projects'),
    skills: plain.skills.join('\n'),
    awards: plain.awards.join('\n'),
  };
}
