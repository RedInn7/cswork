'use client';
import { useEffect, useState } from 'react';
import { nextDeadline, VISA_RULES, visaTimeline, type RuleId, type VisaInput } from '@/lib/visa-timeline';

// Status dates are sensitive: they stay in this browser and are never sent anywhere.
const KEY = 'cswork:visa-timeline';
const read = (): VisaInput => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? (saved as VisaInput) : {};
  } catch {
    return {};
  }
};
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
type DateKey = 'programEnd' | 'optStart' | 'optEnd' | 'permFiled' | 'permApproved' | 'i140Filed' | 'priorityDate' | 'i485Filed';
const DATES: [DateKey, string, string][] = [
  ['programEnd', '项目结束日（I-20 上的 program end date）', 'Program end date (on your I-20)'],
  ['optStart', 'OPT EAD 开始日', 'OPT EAD start date'],
  ['optEnd', 'OPT EAD 到期日', 'OPT EAD end date'],
];
const GREEN: [DateKey, string, string][] = [
  ['permFiled', 'PERM 递交日', 'PERM filed'],
  ['permApproved', 'PERM 批准日', 'PERM approved'],
  ['i140Filed', 'I-140 递交日', 'I-140 filed'],
  ['priorityDate', '优先日', 'Priority date'],
  ['i485Filed', 'I-485 递交日', 'I-485 filed'],
];

/** /career/visa-timeline: dates in, the windows and deadlines that follow from them out. */
export function VisaTimeline({ zh }: { zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [input, setInput] = useState<VisaInput>({});
  // Read after mount: storage and the local date differ from the server's render.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
    setInput(read());
    setToday(localToday());
  }, []);
  const change = (next: VisaInput) => {
    setInput(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private mode or full storage: the plan still works for this visit.
    }
  };
  const clear = () => {
    setInput({});
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing was saved where storage is blocked.
    }
  };
  const events = today ? visaTimeline(input, today) : [];
  const next = today ? nextDeadline(events, today) : null;
  const source = (rule: RuleId) => (
    <a href={VISA_RULES[rule].source} target="_blank" rel="noopener noreferrer" className="visa-source">
      {t('官方说明', 'Official page')}
    </a>
  );
  const dateField = ([key, zhLabel, enLabel]: [DateKey, string, string]) => (
    <label key={key}>
      {t(zhLabel, enLabel)}
      <input
        type="date"
        value={input[key] ?? ''}
        onChange={(e) => change({ ...input, [key]: e.target.value || undefined })}
      />
    </label>
  );
  return (
    <div className="visa-timeline">
      <form className="resume-form visa-form" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend>{t('F-1 与 OPT', 'F-1 and OPT')}</legend>
          {DATES.map(dateField)}
          <label className="visa-check">
            <input type="checkbox" checked={!!input.stem} onChange={(e) => change({ ...input, stem: e.target.checked })} />
            {t('学位在 DHS 的 STEM 专业清单上', 'My degree is on the DHS STEM list')}
          </label>
          <label className="visa-check">
            <input
              type="checkbox"
              checked={!!input.stemFiled}
              onChange={(e) => change({ ...input, stemFiled: e.target.checked })}
            />
            {t('已经递交或获批 STEM OPT 延期', 'I have filed for, or hold, the STEM OPT extension')}
          </label>
        </fieldset>
        <fieldset>
          <legend>{t('H-1B 与绿卡（可选）', 'H-1B and green card (optional)')}</legend>
          <label>
            {t('H-1B 中签的注册年份（未中签留空）', 'Year your H-1B registration was selected (blank if not)')}
            <input
              type="number"
              inputMode="numeric"
              min={2000}
              max={2100}
              value={input.h1bSelected ?? ''}
              onChange={(e) => change({ ...input, h1bSelected: e.target.value ? Number(e.target.value) : undefined })}
            />
          </label>
          {GREEN.map(dateField)}
        </fieldset>
        <div className="resume-actions">
          <button type="button" onClick={clear}>
            {t('清空', 'Clear')}
          </button>
          <small>{t('填写的日期只保存在这个浏览器里，不会上传。', 'What you enter stays in this browser and is never uploaded.')}</small>
        </div>
      </form>

      <section className="visa-result" aria-labelledby="visa-result-title">
        <h2 id="visa-result-title" className="guide-h2">
          {t('你的时间线', 'Your timeline')}
        </h2>
        {next && (
          <output className="visa-next">
            {next.event.severity === 'deadline'
              ? t(`距离下一个截止日还有 ${next.days} 天：`, `${next.days} ${next.days === 1 ? 'day' : 'days'} to the next deadline: `)
              : t(`距离下一个日期还有 ${next.days} 天：`, `${next.days} ${next.days === 1 ? 'day' : 'days'} to the next date: `)}
            <strong>{t(next.event.zh, next.event.en)}</strong>
            {t('（', ' (')}
            <time dateTime={next.event.date}>{next.event.date}</time>
            {t('）', ')')}
          </output>
        )}
        {events.length ? (
          <ol className="visa-events">
            {events.map((e) => (
              <li key={`${e.kind}@${e.date}`} data-severity={e.severity} data-past={(today && e.date < today) || undefined}>
                <time dateTime={e.date}>{e.date}</time>
                <span>
                  {t(e.zh, e.en)}
                  {e.days !== undefined && <b>{t(` · 已过 ${e.days} 天`, ` · ${e.days} days ago`)}</b>}
                </span>
                {source(e.rule)}
              </li>
            ))}
          </ol>
        ) : (
          <p className="visa-empty">
            {t('填上项目结束日或 OPT 日期，这里会列出对应的窗口和截止日。', 'Enter your program end date or OPT dates to see the windows and deadlines that follow.')}
          </p>
        )}
      </section>

      <section aria-labelledby="visa-rules-title">
        <h2 id="visa-rules-title" className="guide-h2">
          {t('计算依据', 'Rules used')}
        </h2>
        <ol className="visa-rules">
          {(Object.keys(VISA_RULES) as RuleId[]).map((id) => (
            <li key={id}>
              <p>{t(VISA_RULES[id].zh, VISA_RULES[id].en)}</p>
              <small>
                {t(`核实于 ${VISA_RULES[id].verifiedOn}`, `Checked on ${VISA_RULES[id].verifiedOn}`)} · {source(id)}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
