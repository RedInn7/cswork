'use client';
import { useEffect, useRef, useState } from 'react';
import { autofillData, autofillHref } from '@/lib/autofill-bookmarklet';
import { ojRequest } from '@/lib/oj-client';
import { checkResume, type ResumeIssue } from '@/lib/resume-check';
import { readResumeFile, type ResumeFileError } from '@/lib/resume-file';
import { parseResumeText } from '@/lib/resume-parse';
import { blankItem, blankResume, ITEMS, lines, MAX, normalizeResume, type ListKey, type Resume, type ResumeItem } from '@/lib/resume-shape';
import { ResumeReviewLink } from './resume-review-link';

/**
 * /career/resume/builder: a one-page, single-column resume (standard headings, no tables, images or
 * columns, real text) previewed as it prints. It lives in this browser only (localStorage), like
 * the review page's promise; JSON export and import move it between devices.
 */
export const RESUME_KEY = 'cswork:resume:v1';
/** The review page (components/resume-review.tsx) picks this up once, then drops it. */
export const REVIEW_KEY = 'cswork:resume:review';
/**
 * Named copies of the resume, one per kind of job ({name: Resume}, at most MAX_VERSIONS, names up
 * to VERSION_NAME characters); RESUME_KEY stays the base. The tracker's resume-version list reads
 * the names (it writes this key literally rather than importing this file).
 */
export const RESUME_VERSIONS_KEY = 'cswork:resume:versions';
const MAX_VERSIONS = 10;
const VERSION_NAME = 40;

// The shape lives in lib/resume-shape.ts (server code reads it too); re-exported for existing importers.
export { blankResume, normalizeResume, type Resume, type ResumeItem };

export type ResumeFacts = {
  certificates: { id: string; course: string; issuedAt: number; skill: boolean }[];
  rating: number | null;
  contests: number;
  solved: { total: number; easy: number; medium: number; hard: number };
  handle: string | null;
};

/** The stored versions, cleaned like an import: bad names and entries past MAX_VERSIONS dropped. */
export function readVersions(): Record<string, Resume> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RESUME_VERSIONS_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const named = Object.entries(raw).filter(([name]) => name.trim() && name.length <= VERSION_NAME);
    return Object.fromEntries(named.slice(0, MAX_VERSIONS).map(([name, r]) => [name, normalizeResume(r)]));
  } catch {
    return {};
  }
}
/** How many fields (contact lines, sections, each entry's fields) differ between two resumes. */
export function resumeDiff(a: Resume, b: Resume) {
  let n = 0;
  for (const key of Object.keys(a) as (keyof Resume)[]) {
    const [x, y] = [a[key], b[key]];
    if (typeof x === 'string') n += +(x !== y);
    else
      for (let i = 0; i < Math.max(x.length, (y as ResumeItem[]).length); i++)
        for (const field of ['title', 'subtitle', 'dates', 'bullets'] as const) n += +((x[i]?.[field] ?? '') !== ((y as ResumeItem[])[i]?.[field] ?? ''));
  }
  return n;
}

const filled = (item: ResumeItem) => !!(item.title.trim() || item.subtitle.trim() || item.dates.trim() || item.bullets.trim());
const contact = (r: Resume) => [r.email, r.phone, r.location, r.links].map((s) => s.trim()).filter(Boolean).join(' | ');
// Standard English headings: what applicant tracking systems look for.
const HEADINGS: [ListKey, string][] = [
  ['education', 'Education'],
  ['experience', 'Experience'],
  ['projects', 'Projects'],
];

/** The resume as plain text, for the AI review page. */
export function resumeText(r: Resume) {
  const out = [r.name.trim(), contact(r)];
  for (const [key, heading] of HEADINGS) {
    const items = r[key].filter(filled);
    if (!items.length) continue;
    out.push('', heading.toUpperCase());
    for (const item of items) {
      out.push([item.title, item.subtitle, item.dates].map((s) => s.trim()).filter(Boolean).join(' | '));
      for (const bullet of lines(item.bullets)) out.push(`- ${bullet}`);
    }
  }
  if (lines(r.skills).length) out.push('', 'SKILLS', ...lines(r.skills));
  if (lines(r.awards).length) out.push('', 'AWARDS & CERTIFICATIONS', ...lines(r.awards).map((l) => `- ${l}`));
  return out.filter((line, i) => line || i > 1).join('\n').trim();
}

const month = (time: number) => new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(time);
const appendLines = (value: string, add: string[]) => {
  const have = new Set(lines(value));
  const fresh = add.filter((line) => !have.has(line));
  return { value: [value.trimEnd(), ...fresh].filter(Boolean).join('\n'), added: fresh.length };
};
/** `value` without its older CSWork line (matched by `stale`) when `line` brings a new one: numbers get replaced, not stacked. */
const refresh = (value: string, stale: RegExp, line?: string) =>
  !line || lines(value).includes(line) ? value : value.split('\n').filter((row) => !stale.test(lines(row)[0] ?? '')).join('\n');
/**
 * The learner's CSWork record merged in, each line once: certificates (with their verification
 * links) and the contest rating under awards, the solved counts under skills, the public profile
 * under links. A newer rating or solved count replaces the old line. Returns how many lines were new.
 */
export function mergeFacts(r: Resume, f: ResumeFacts) {
  const rating = f.rating === null ? [] : [`CSWork contest rating ${f.rating} (${f.contests} rated ${f.contests === 1 ? 'contest' : 'contests'})`];
  const solved = f.solved.total
    ? [`Algorithms: ${f.solved.total} problems solved on CSWork (${f.solved.easy} easy, ${f.solved.medium} medium, ${f.solved.hard} hard)`]
    : [];
  const awards = appendLines(refresh(r.awards, /^CSWork contest rating \d+ \(/, rating[0]), [
    ...f.certificates.map(
      (c) => `${c.course}, CSWork ${c.skill ? 'skill certification' : 'certificate'}, ${month(c.issuedAt)} (cswork.org/certificate/${c.id})`,
    ),
    ...rating,
  ]);
  const skills = appendLines(refresh(r.skills, /^Algorithms: \d+ problems solved on CSWork /, solved[0]), solved);
  const profile = f.handle ? `cswork.org/u/${f.handle}` : '';
  const linkNew = !!profile && !r.links.includes(profile);
  return {
    resume: { ...r, awards: awards.value, skills: skills.value, links: linkNew ? [r.links.trim(), profile].filter(Boolean).join(', ') : r.links },
    added: awards.added + skills.added + +linkNew,
  };
}

function download(name: string, body: string) {
  try {
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // No Blob URLs here (an old browser or a sandbox): nothing to download.
  }
}

const SECTIONS: { key: ListKey; legend: [string, string]; fields: [keyof ResumeItem, string, string][]; add: [string, string] }[] = [
  {
    key: 'education',
    legend: ['教育经历', 'Education'],
    fields: [
      ['title', '学校', 'School'],
      ['subtitle', '学位与专业', 'Degree and major'],
      ['dates', '时间（例如 Aug 2023 – May 2027）', 'Dates (e.g. Aug 2023 – May 2027)'],
      ['bullets', '要点，每行一条（GPA、相关课程）', 'Bullets, one per line (GPA, coursework)'],
    ],
    add: ['添加教育经历', 'Add education'],
  },
  {
    key: 'experience',
    legend: ['工作经历', 'Experience'],
    fields: [
      ['title', '公司', 'Company'],
      ['subtitle', '职位与地点', 'Role and location'],
      ['dates', '时间', 'Dates'],
      ['bullets', '要点，每行一条：做了什么、怎么做、带来什么结果（最好有数字）', 'Bullets, one per line: what you did, how, and the result (with a number)'],
    ],
    add: ['添加工作经历', 'Add experience'],
  },
  {
    key: 'projects',
    legend: ['项目', 'Projects'],
    fields: [
      ['title', '项目名称', 'Project'],
      ['subtitle', '技术栈或链接', 'Tech stack or link'],
      ['dates', '时间', 'Dates'],
      ['bullets', '要点，每行一条', 'Bullets, one per line'],
    ],
    add: ['添加项目', 'Add project'],
  },
];
const FILE_ERRORS: Record<ResumeFileError, [string, string]> = {
  'too-big': [
    '文件超过 5 MB：导出一份不带图片的 PDF 或 .docx 再试，或者复制文字用「粘贴文本导入」。',
    'The file is over 5 MB: export a PDF or .docx without images, or copy its text into “Paste text to import”.',
  ],
  type: [
    '只能读取 PDF 和 .docx：先在 Word、WPS 或 Pages 里另存为 .docx 或 PDF。',
    'Only PDF and .docx files can be read: save it as .docx or PDF from Word, WPS or Pages first.',
  ],
  docx: [
    '读不出这个文件里的 Word 正文（文件可能损坏、加密，或者不是 .docx）：重新另存为 .docx 或 PDF，或者复制文字用「粘贴文本导入」。',
    'No Word text could be read from this file (it may be damaged, encrypted or not a .docx): save it again as .docx or PDF, or copy its text into “Paste text to import”.',
  ],
  pdf: [
    '没能读出这个 PDF（文件可能加密或损坏，也可能没能从 jsDelivr 下载 pdf.js）：复制文字用「粘贴文本导入」。',
    'This PDF could not be read (it may be encrypted or damaged, or pdf.js could not be downloaded from jsDelivr): copy its text into “Paste text to import”.',
  ],
  scanned: [
    '这个 PDF 里没有文字层（多半是扫描件或图片）：把内容整理成文字，用「粘贴文本导入」。',
    'This PDF has no text layer (most likely a scan or an image): type or copy the text into “Paste text to import”.',
  ],
};
const CONTACT: [Exclude<keyof Resume, ListKey>, string, string, string][] = [
  ['name', '姓名', 'Full name', 'name'],
  ['email', '邮箱', 'Email', 'email'],
  ['phone', '电话', 'Phone', 'tel'],
  ['location', '所在城市', 'Location', 'address-level2'],
  ['links', '链接（GitHub、LinkedIn、个人网站，用逗号分隔）', 'Links (GitHub, LinkedIn, website; comma-separated)', 'url'],
];

export function ResumeBuilder({ zh, signedIn, ai = false }: { zh: boolean; signedIn: boolean; ai?: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [base, setBase] = useState<Resume>(blankResume);
  const [versions, setVersions] = useState<Record<string, Resume>>({});
  // '' is the base resume; otherwise the name of the version being edited.
  const [version, setVersion] = useState('');
  const [newName, setNewName] = useState('');
  const [pasted, setPasted] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Resume | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  const resume = (version && versions[version]) || base;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RESUME_KEY);
      // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
      if (saved) setBase(normalizeResume(JSON.parse(saved)));
    } catch {
      // Blocked storage or a damaged entry: start blank.
    }
    setVersions(readVersions());
  }, []);
  // The sheet is 7.5in wide (Letter less 0.5in margins): taller than 10in runs onto a second page.
  // Compared in its own units, so the preview's screen zoom doesn't matter.
  useEffect(() => {
    const el = sheet.current;
    // oxlint-disable-next-line react/react-compiler -- Measured after layout.
    if (el) setOverflow(el.clientWidth > 0 && el.scrollHeight > (el.clientWidth * 4) / 3 + 2);
  }, [resume]);
  const saveVersions = (next: Record<string, Resume>) => {
    setVersions(next);
    try {
      localStorage.setItem(RESUME_VERSIONS_KEY, JSON.stringify(next));
    } catch {
      // Private mode or full storage: the versions still work for this visit.
    }
  };
  const change = (next: Resume) => {
    if (version) return saveVersions({ ...versions, [version]: next });
    setBase(next);
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify(next));
    } catch {
      // Private mode or full storage: the resume still works for this visit.
    }
  };
  const editItem = (key: ListKey, index: number, field: keyof ResumeItem, value: string) =>
    change({ ...resume, [key]: resume[key].map((item, i) => (i === index ? { ...item, [field]: value } : item)) });
  async function fill() {
    setBusy(true);
    try {
      const merged = mergeFacts(resume, await ojRequest<ResumeFacts>('profile/resume-facts'));
      change(merged.resume);
      setStatus(merged.added ? t(`已填入 ${merged.added} 条站内成绩。`, `Added ${merged.added} ${merged.added === 1 ? 'line' : 'lines'} from CSWork.`) : t('没有新的站内成绩可以填入。', 'Nothing new to add from CSWork.'));
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function load(file: File | undefined) {
    if (!file) return;
    try {
      change(normalizeResume(JSON.parse(await file.text())));
      setStatus(t('已导入简历。', 'Resume imported.'));
    } catch {
      setStatus(t('这个文件不是导出的简历 JSON。', 'That file is not an exported resume JSON.'));
    }
  }
  // A PDF or .docx read in this browser lands in the paste panel with its preview: nothing is replaced until the confirm.
  async function importFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setStatus(t('正在读取文件…', 'Reading the file…'));
    try {
      const text = await readResumeFile(file);
      setPasted(text);
      setParsed(parseResumeText(text));
      setStatus(t('已读出文件里的文字：对照下面的解析结果，确认后才会覆盖。', 'Text read from the file: check what was read below; nothing is replaced until you confirm.'));
    } catch (e) {
      setStatus(t(...(FILE_ERRORS[(e as Error).message as ResumeFileError] ?? FILE_ERRORS.pdf)));
    }
  }
  function review() {
    try {
      sessionStorage.setItem(REVIEW_KEY, resumeText(resume));
    } catch {
      // The review page then just opens empty.
    }
    location.assign('/career/resume');
  }
  function copyVersion() {
    const name = newName.trim();
    if (!name || versions[name]) return setStatus(t('换一个还没用过的版本名称。', 'Pick a version name not used yet.'));
    if (Object.keys(versions).length >= MAX_VERSIONS)
      return setStatus(t(`最多保存 ${MAX_VERSIONS} 个版本，先删掉一个。`, `Up to ${MAX_VERSIONS} versions: delete one first.`));
    saveVersions({ ...versions, [name]: resume });
    setVersion(name);
    setNewName('');
    setStatus(t(`已复制为新版本「${name}」，接下来的修改只改这个版本。`, `Copied as “${name}”: edits now change this version only.`));
  }
  function deleteVersion() {
    if (!window.confirm(t(`删除版本「${version}」？删除后无法恢复。`, `Delete the version “${version}”? This cannot be undone.`))) return;
    const { [version]: _gone, ...rest } = versions;
    saveVersions(rest);
    setVersion('');
    setStatus(t('已删除这个版本，现在编辑的是基础版。', 'Version deleted: you are editing the base resume.'));
  }
  // A rule-check issue's field: scrolled to and focused (a section without entries focuses its add button).
  function jump(where: string) {
    const el = document.getElementById(`resume-${where.replace(/\./g, '-')}`);
    const field = el?.matches('input, textarea') ? el : el?.querySelector<HTMLElement>('input, textarea, button');
    el?.scrollIntoView?.({ block: 'center' });
    field?.focus({ preventScroll: true });
  }
  function applyPasted() {
    if (!parsed) return;
    change(normalizeResume(parsed));
    setPasted(null);
    setParsed(null);
    setStatus(t('已导入粘贴的简历：对照预览和检查，改掉没识别对的地方。', 'Pasted resume imported: check the preview and the rule check for anything read wrong.'));
  }
  const check = checkResume(resume);
  const names = Object.keys(versions);
  const diff = version ? resumeDiff(resume, base) : 0;
  const contactLine = contact(resume);
  return (
    <div className="resume-builder">
      <div className="resume-actions resume-versions">
        <label>
          {t('正在编辑', 'Editing')}
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            <option value="">{t('基础版', 'Base resume')}</option>
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {version && <small>{t(`与基础版有 ${diff} 处不同`, `${diff} ${diff === 1 ? 'field differs' : 'fields differ'} from the base`)}</small>}
        <label>
          {t('新版本名称（例如 后端、数据）', 'New version name (e.g. Backend, Data)')}
          <input value={newName} maxLength={VERSION_NAME} onChange={(e) => setNewName(e.target.value)} />
        </label>
        <button type="button" className="is-quiet" disabled={!newName.trim()} onClick={copyVersion}>
          {t('复制为新版本', 'Copy as new version')}
        </button>
        {version && (
          <button type="button" className="is-quiet" onClick={deleteVersion}>
            {t('删除这个版本', 'Delete this version')}
          </button>
        )}
      </div>
      <form className="resume-form resume-builder-form" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="resume-fieldset">
          <legend>{t('基本信息', 'Contact')}</legend>
          {CONTACT.map(([key, zhLabel, enLabel, autoComplete]) => (
            <label key={key}>
              {t(zhLabel, enLabel)}
              <input
                id={`resume-${key}`}
                value={resume[key] as string}
                autoComplete={autoComplete}
                maxLength={MAX[key]}
                onChange={(e) => change({ ...resume, [key]: e.target.value })}
              />
            </label>
          ))}
        </fieldset>
        {SECTIONS.map(({ key, legend, fields, add }) => (
          <fieldset key={key} id={`resume-${key}`} className="resume-fieldset">
            <legend>{t(...legend)}</legend>
            {resume[key].map((item, index) => (
              <div key={index} className="resume-entry">
                {fields.map(([field, zhLabel, enLabel]) => (
                  <label key={field}>
                    {t(zhLabel, enLabel)}
                    {field === 'bullets' ? (
                      <textarea
                        id={`resume-${key}-${index}-${field}`}
                        rows={4}
                        value={item[field]}
                        maxLength={MAX.bullets}
                        onChange={(e) => editItem(key, index, field, e.target.value)}
                      />
                    ) : (
                      <input
                        id={`resume-${key}-${index}-${field}`}
                        value={item[field]}
                        maxLength={MAX[field]}
                        onChange={(e) => editItem(key, index, field, e.target.value)}
                      />
                    )}
                  </label>
                ))}
                <button
                  type="button"
                  className="resume-remove"
                  onClick={() => change({ ...resume, [key]: resume[key].filter((_, i) => i !== index) })}
                >
                  {t(`删除第 ${index + 1} 条${legend[0]}`, `Remove ${legend[1].toLowerCase()} ${index + 1}`)}
                </button>
              </div>
            ))}
            {resume[key].length < ITEMS && (
              <button type="button" className="resume-add" onClick={() => change({ ...resume, [key]: [...resume[key], blankItem()] })}>
                + {t(...add)}
              </button>
            )}
          </fieldset>
        ))}
        <fieldset className="resume-fieldset">
          <legend>{t('技能、奖项与证书', 'Skills, awards and certifications')}</legend>
          <label>
            {t('技能，每行一类（例如 Languages: Python, Go）', 'Skills, one group per line (e.g. Languages: Python, Go)')}
            <textarea id="resume-skills" rows={4} value={resume.skills} maxLength={MAX.skills} onChange={(e) => change({ ...resume, skills: e.target.value })} />
          </label>
          <label>
            {t('奖项与证书，每行一条', 'Awards and certifications, one per line')}
            <textarea id="resume-awards" rows={4} value={resume.awards} maxLength={MAX.awards} onChange={(e) => change({ ...resume, awards: e.target.value })} />
          </label>
          {signedIn && (
            <div className="resume-actions">
              <button type="button" className="is-quiet" disabled={busy} onClick={() => void fill()} aria-describedby="resume-fill-hint">
                {t('从 CSWork 填入', 'Fill in from CSWork')}
              </button>
              <small id="resume-fill-hint">
                {t('把你的证书和比赛 rating 加到奖项里，把解题数加到技能里。', 'Adds your certificates and contest rating to awards, and your solved counts to skills.')}
              </small>
            </div>
          )}
        </fieldset>
      </form>
      <div className="resume-builder-preview">
        <div className="resume-actions resume-builder-tools">
          <button type="button" onClick={() => window.print()}>
            {t('保存为 PDF', 'Save as PDF')}
          </button>
          {ai && (
            <button type="button" className="is-quiet" disabled={!resumeText(resume)} onClick={review}>
              {t('送去 AI 点评', 'Send to AI review')}
            </button>
          )}
          <button type="button" className="is-quiet" onClick={() => download('cswork-resume.json', JSON.stringify(resume, null, 2))}>
            {t('导出 JSON', 'Export JSON')}
          </button>
          <label className="resume-import">
            {t('导入 JSON', 'Import JSON')}
            <input type="file" accept="application/json,.json" onChange={(e) => void load(e.target.files?.[0])} />
          </label>
          <label className="resume-import">
            {t('导入 PDF / DOCX', 'Import PDF / DOCX')}
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => void importFile(e.target)}
            />
          </label>
          <button
            type="button"
            className="is-quiet"
            aria-expanded={pasted !== null}
            onClick={() => {
              setPasted(pasted === null ? '' : null);
              setParsed(null);
            }}
          >
            {t('粘贴文本导入', 'Paste text to import')}
          </button>
        </div>
        {signedIn && <ResumeReviewLink resume={resume} version={version} />}
        {pasted !== null && (
          <div className="resume-form resume-paste">
            <label>
              {t('粘贴简历全文（从 PDF 或文档里复制）', 'Your resume as text (copied from a PDF or a document)')}
              <textarea
                rows={8}
                value={pasted}
                maxLength={20_000}
                onChange={(e) => {
                  setPasted(e.target.value);
                  setParsed(null);
                }}
              />
            </label>
            <div className="resume-actions">
              <button type="button" disabled={!pasted.trim()} onClick={() => setParsed(parseResumeText(pasted))}>
                {t('预览解析结果', 'Preview')}
              </button>
            </div>
            {parsed && <PastePreview parsed={parsed} zh={zh} onApply={applyPasted} replacing={version ? t(`「${version}」`, `“${version}”`) : t('基础版', 'the base resume')} />}
          </div>
        )}
        <section className="resume-check" id="resume-check" aria-labelledby="resume-check-title">
          <h2 id="resume-check-title">
            {t('规则检查', 'Rule check')} <span>{check.score}</span>
            <small>/100</small>
          </h2>
          {check.issues.length ? (
            <>
              <p>{t('先改这几条（点一条跳到对应的输入框）：', 'Fix these first (each opens its field):')}</p>
              <IssueList issues={check.issues.slice(0, 3)} zh={zh} jump={jump} />
              {check.issues.length > 3 && (
                <details>
                  <summary>{t(`其余 ${check.issues.length - 3} 条`, `${check.issues.length - 3} more`)}</summary>
                  <IssueList issues={check.issues.slice(3)} zh={zh} jump={jump} start={4} />
                </details>
              )}
            </>
          ) : (
            <p>{t('规则检查没有发现问题。', 'The rule check found nothing to fix.')}</p>
          )}
          <small>{t('按规则检查，不是 AI：看动词、数字、长度、用词、日期和必备小节。', 'Rules, not AI: verbs, numbers, length, wording, dates and the sections every resume needs.')}</small>
        </section>
        <AutofillBookmarklet resume={resume} version={version} zh={zh} />
        <p className="resume-builder-status" role="status">
          {status}
        </p>
        {overflow && (
          <p className="resume-page-warning" role="status">
            {t('预览已超过一页：删掉较弱的要点，或把每条缩短到一行。', 'The preview runs past one page: cut the weakest bullets or shorten each to one line.')}
          </p>
        )}
        <div className="resume-paper">
          <article className="resume-sheet" ref={sheet} aria-label={t('简历预览', 'Resume preview')}>
            <header>
              <h2>{resume.name.trim() || t('你的姓名', 'Your Name')}</h2>
              {contactLine && <p>{contactLine}</p>}
            </header>
            {HEADINGS.map(([key, heading]) => {
              const items = resume[key].filter(filled);
              return (
                items.length > 0 && (
                  <section key={key}>
                    <h3>{heading}</h3>
                    {items.map((item, index) => (
                      <div key={index} className="resume-sheet-item">
                        <p className="resume-sheet-head">
                          <strong>{item.title}</strong>
                          <span>{item.dates}</span>
                        </p>
                        {item.subtitle && <p className="resume-sheet-sub">{item.subtitle}</p>}
                        {lines(item.bullets).length > 0 && (
                          <ul>
                            {lines(item.bullets).map((bullet, i) => (
                              <li key={i}>{bullet}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </section>
                )
              );
            })}
            {lines(resume.skills).length > 0 && (
              <section>
                <h3>Skills</h3>
                {lines(resume.skills).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </section>
            )}
            {lines(resume.awards).length > 0 && (
              <section>
                <h3>Awards &amp; Certifications</h3>
                <ul>
                  {lines(resume.awards).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}

/**
 * The autofill bookmarklet for the resume being edited (lib/autofill-bookmarklet.ts). React blocks
 * javascript: hrefs, so the link gets it after mount and again after every edit.
 */
function AutofillBookmarklet({ resume, version, zh }: { resume: Resume; version: string; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute('href', autofillHref(autofillData(resume), { origin: location.origin, zh }));
  }, [resume, zh]);
  return (
    <details className="resume-autofill" id="resume-autofill">
      <summary>{t('网申填表书签（Greenhouse、Lever、Ashby）', 'Application autofill bookmarklet (Greenhouse, Lever, Ashby)')}</summary>
      <div className="tracker-bookmarklet">
        {/* Clicked here it would only run on this page: it is for dragging to the bookmarks bar. */}
        <a ref={ref} href="#resume-autofill" onClick={(e) => e.preventDefault()}>
          {t('网申填表', 'Autofill application')}
          {version && ` · ${version}`}
        </a>
        <p>
          {t(
            '把这个按钮拖到浏览器的书签栏。在 Greenhouse、Lever、Ashby 的申请页上点它，会把姓名、邮箱、电话、城市、链接、学校、学位和最近一家公司填进还空着的文本框；已经有内容的框、下拉框、附件上传和问答题都不碰，也不会替你提交。填完逐项检查，再自己提交。公司官网里嵌着的申请表，书签会先问你要不要打开申请表本身。',
            'Drag this button to your bookmarks bar. On a Greenhouse, Lever or Ashby application page, click it: your name, email, phone, city, links, school, degree and latest company go into the text fields that are still empty. Filled fields, dropdowns, file uploads and long answers are left alone, and nothing is submitted: check every field, then submit it yourself. When a company site embeds the form, the bookmarklet first offers to open the form itself.',
          )}{' '}
          <strong>
            {t(
              '书签里存着这些个人信息，会随浏览器同步，不要分享给别人。简历改了要重新拖一次，旧书签不会自己更新。',
              'The bookmark holds this personal information and syncs with your browser: do not share it. After editing the resume, drag it again; an old bookmark does not update itself.',
            )}
          </strong>
        </p>
      </div>
    </details>
  );
}

function IssueList({ issues, zh, jump, start }: { issues: ResumeIssue[]; zh: boolean; jump: (where: string) => void; start?: number }) {
  return (
    <ol start={start}>
      {issues.map((issue, i) => (
        <li key={i}>
          <button type="button" onClick={() => jump(issue.where)}>
            {zh ? issue.zh : issue.en}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** What the paste import read, section by section, before it replaces anything. */
function PastePreview({ parsed, zh, onApply, replacing }: { parsed: Resume; zh: boolean; onApply: () => void; replacing: string }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const none = t('（没有识别出）', '(none found)');
  const rows: [string, string][] = [
    [t('姓名', 'Name'), parsed.name],
    [t('联系方式', 'Contact'), contact(parsed)],
    ...SECTIONS.map(({ key, legend }): [string, string] => {
      const items = parsed[key].filter(filled);
      const bullets = items.reduce((n, item) => n + lines(item.bullets).length, 0);
      return [
        t(...legend),
        items.length ? `${items.map((item) => [item.title, item.dates].filter(Boolean).join(' · ')).join('; ')} (${t(`${bullets} 条要点`, `${bullets} ${bullets === 1 ? 'bullet' : 'bullets'}`)})` : '',
      ];
    }),
    [t('技能', 'Skills'), lines(parsed.skills).join('; ')],
    [t('奖项与证书', 'Awards'), lines(parsed.awards).join('; ')],
  ];
  return (
    <section className="resume-paste-preview" aria-label={t('解析结果', 'What was read')}>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || none}</dd>
          </div>
        ))}
      </dl>
      <div className="resume-actions">
        <button type="button" onClick={onApply}>
          {t(`用它覆盖${replacing}`, `Replace ${replacing} with this`)}
        </button>
      </div>
    </section>
  );
}
