'use client';

import { useState, type SubmitEvent } from 'react';
import {
  ROUTE_MAX_STEPS,
  STEP_KINDS,
  STEP_LABELS,
  stepId,
  type ResolvedStep,
  type RouteDoc,
} from '@/lib/content/role-paths';
import { readLocale } from '@/lib/i18n';
import type { scheduleRoute } from '@/lib/route-schedule';
import { isDay } from '@/lib/study-plan';

type Plan = ReturnType<typeof scheduleRoute>;

/** Saves a route note (an empty body deletes it); throws the server's message. */
export async function saveRoute(target: string, doc: RouteDoc | null) {
  const response = await fetch(`/api/oj/notes?target=${encodeURIComponent(target)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Locale': readLocale() },
    body: JSON.stringify({ body: doc ? JSON.stringify(doc) : '' }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(typeof result?.error === 'string' ? result.error : `HTTP ${response.status}`);
  }
}

/** "10月18日" / "Oct 18", with the year when it is not this one. */
export function dayLabel(day: string, today: string, english: boolean) {
  const [y, m, d] = day.split('-').map(Number);
  const year = day.slice(0, 4) !== today.slice(0, 4);
  if (!english) return `${year ? `${y}年` : ''}${m}月${d}日`;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(year && { year: 'numeric' }),
    timeZone: 'UTC',
  });
}
/** "约 2.5 小时" / "~2.5 h", or minutes under an hour. */
export function timeLabel(minutes: number, english: boolean) {
  if (minutes < 60) return english ? `~${minutes} min` : `约 ${minutes} 分钟`;
  const hours = Math.round(minutes / 30) / 2;
  return english ? `~${hours} h` : `约 ${hours} 小时`;
}

const WEEKS_SHOWN = 26;

/**
 * Below the steps: the target date and weekly hours, when the route ends at that pace and what the
 * target date needs, the week-by-week timeline, "Save schedule" (the finish days become the plan that
 * "behind" compares with) and the .ics download.
 */
export function RouteSchedule({
  english,
  doc,
  plan,
  today,
  titles,
  onChange,
  onSave,
  onExport,
  busy,
}: {
  english: boolean;
  doc: RouteDoc;
  /** While the saved schedule is still loading: edits would be lost. */
  busy: boolean;
  plan: Plan | null;
  today: string | null;
  titles: Record<string, string>;
  onChange: (doc: RouteDoc) => void;
  onSave: () => void;
  onExport: () => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const day = (date: string) => dayLabel(date, today ?? date, english);
  const target = doc.targetDate;
  const summary = () => {
    if (!plan || !today) return '';
    if (!plan.end) return t('剩下的步骤都已完成、跳过或是选做，没有要排的了。', 'Every step left is done, skipped or optional: nothing to schedule.');
    const pace = t(`按每周 ${doc.weeklyHours} 小时，预计 ${day(plan.end)} 走完。`, `At ${doc.weeklyHours} h a week you finish on ${day(plan.end)}.`);
    if (!target) return pace;
    if (target < today) return `${pace} ${t('目标日已经过了，换一个新的吧。', 'The target date has passed; pick a new one.')}`;
    if (plan.end <= target) return `${pace} ${t(`赶得上目标日 ${day(target)}。`, `That makes your target date, ${day(target)}.`)}`;
    return `${pace} ${t(
      `要在 ${day(target)} 前走完，每周需要约 ${plan.needHours} 小时。`,
      `To finish by ${day(target)} you need about ${plan.needHours} h a week.`,
    )}`;
  };
  return (
    <section className="role-path-schedule" aria-labelledby="role-path-schedule-title">
      <h3 id="role-path-schedule-title">{t('排期', 'Schedule')}</h3>
      <fieldset className="role-path-fields" disabled={busy}>
        <legend className="sr-only">{t('目标和节奏', 'Target and pace')}</legend>
        <label>
          {t('目标日期', 'Target date')}
          <input
            type="date"
            value={target}
            min={today ?? undefined}
            onChange={(e) => (e.target.value === '' || isDay(e.target.value)) && onChange({ ...doc, targetDate: e.target.value })}
          />
        </label>
        <label>
          {t('每周小时数', 'Hours a week')}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            step={1}
            value={doc.weeklyHours}
            onChange={(e) => {
              const hours = Number(e.target.value);
              if (Number.isInteger(hours) && hours >= 1 && hours <= 40) onChange({ ...doc, weeklyHours: hours });
            }}
          />
        </label>
      </fieldset>
      <p className="role-path-pace" role="status" data-late={(target && plan?.end && plan.end > target) || undefined}>
        {summary()}
      </p>
      {plan && plan.weeks.length > 0 && (
        <>
          <ol className="role-path-weeks" aria-label={t('按周的时间轴', 'Week by week')}>
            {plan.weeks.slice(0, WEEKS_SHOWN).map((week, i) => (
              <li key={week.start}>
                <p className="role-path-week">
                  {i === 0 ? t('本周', 'This week') : `${day(week.start)} – ${day(week.end)}`}
                </p>
                <ul>
                  {week.items.map((item) => (
                    <li key={item.id}>
                      {titles[item.id]} <span>{timeLabel(item.minutes, english)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {plan.weeks.length > WEEKS_SHOWN && (
            <p className="role-path-note">
              {t(
                `之后还有 ${plan.weeks.length - WEEKS_SHOWN} 周，提高每周小时数可以缩短。`,
                `${plan.weeks.length - WEEKS_SHOWN} more weeks after these; more hours a week shortens it.`,
              )}
            </p>
          )}
          <div className="role-path-actions">
            <button type="button" onClick={onSave}>
              {t('保存排期', 'Save schedule')}
            </button>
            <button type="button" onClick={onExport}>
              {t('导出 .ics', 'Export .ics')}
            </button>
          </div>
          <p className="role-path-note">
            {t(
              '保存后，哪一步过了预计完成日还没做完，这里会提醒你。估时按题目难度、章节阅读时长和项目工时算，只是参考。',
              'Once saved, a step still unfinished after its day shows here as behind. Estimates come from problem difficulty, reading time and project hours: a guide, not a promise.',
            )}
          </p>
        </>
      )}
    </section>
  );
}

const KIND_GROUPS: Record<string, [string, string]> = { course: ['入门课', 'Crash courses'] };

/**
 * A learner-made route's editor: its name, a picker of the site's content grouped by kind, an entry of
 * the learner's own (a title, how many units and the minutes each takes: never a link), and deleting
 * the route. Moving and removing steps sit on the steps themselves (components/role-path.tsx).
 */
export function RouteEditor({
  english,
  doc,
  catalog,
  titleOf,
  onChange,
  onDelete,
}: {
  english: boolean;
  doc: RouteDoc;
  catalog: Record<string, ResolvedStep>;
  titleOf: (step: ResolvedStep) => string;
  onChange: (doc: RouteDoc) => void;
  onDelete: () => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [pick, setPick] = useState('');
  const steps = doc.steps ?? [];
  const taken = new Set(steps.map(stepId));
  const full = steps.length >= ROUTE_MAX_STEPS;
  // Single Line 500 stops by name; the roles' multi-stop steps come only with a copied route.
  const options = (kind: string) =>
    Object.entries(catalog).flatMap(([id, step]) =>
      step.kind !== kind || step.ref.includes(',')
        ? []
        : [[id, step.kind === 'line-stops' ? `${step.stops?.[0].name} (${step.keys.length})` : titleOf(step)] as const],
    );
  const addSite = () => {
    const step = catalog[pick];
    if (!step || taken.has(pick) || full) return;
    onChange({ ...doc, steps: [...steps, { kind: step.kind, ref: step.ref }] });
    setPick('');
  };
  const addExt = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = (data.get('title') as string).trim();
    if (!title || full) return;
    let id = '';
    while (!id || taken.has(id)) id = `ext-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
    const units = Number(data.get('units')),
      unitMinutes = Number(data.get('unitMinutes'));
    onChange({ ...doc, steps: [...steps, { kind: 'ext', id, title, units, done: 0, unitMinutes }] });
    form.reset();
  };
  return (
    <section className="role-path-editor" aria-labelledby="role-path-editor-title">
      <h3 id="role-path-editor-title">{t('编辑路线', 'Edit the route')}</h3>
      <label className="role-path-name">
        {t('路线名称', 'Route name')}
        <input
          maxLength={60}
          value={doc.name ?? ''}
          onChange={(e) => onChange({ ...doc, name: e.target.value.trim() ? e.target.value : undefined })}
        />
      </label>
      {full && (
        <p className="role-path-note" role="status">
          {t(`一条路线最多 ${ROUTE_MAX_STEPS} 步。`, `A route holds at most ${ROUTE_MAX_STEPS} steps.`)}
        </p>
      )}
      <div className="role-path-add">
        <label>
          {t('加入站内内容', 'Add site content')}
          <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={full}>
            <option value="">{t('选择…', 'Choose…')}</option>
            {STEP_KINDS.map((kind) => {
              const label = STEP_LABELS[kind] ?? KIND_GROUPS[kind];
              return (
                <optgroup key={kind} label={label[english ? 1 : 0]}>
                  {options(kind).map(([id, name]) => (
                    <option key={id} value={id} disabled={taken.has(id)}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        <button type="button" onClick={addSite} disabled={!pick || full}>
          {t('加入路线', 'Add to route')}
        </button>
      </div>
      <form className="role-path-add" onSubmit={addExt}>
        <label>
          {t('外部条目', 'Your own entry')}
          <input name="title" required maxLength={80} placeholder={t('例如 CS61B 第 1–12 讲', 'e.g. CS61B lectures 1–12')} disabled={full} />
        </label>
        <label>
          {t('共几个单元', 'Units')}
          <input name="units" type="number" required min={1} max={500} defaultValue={1} disabled={full} />
        </label>
        <label>
          {t('每单元分钟', 'Minutes each')}
          <input name="unitMinutes" type="number" required min={5} max={600} step={5} defaultValue={60} disabled={full} />
        </label>
        <button type="submit" disabled={full}>
          {t('添加外部条目', 'Add entry')}
        </button>
      </form>
      <p className="role-path-note">
        {t(
          '外部条目只记标题和进度，不存链接；每学完一个单元点一次「+1」。',
          'Your own entries keep a title and progress, never a link; press “+1” after each unit.',
        )}
      </p>
      <button type="button" className="role-path-delete" onClick={onDelete}>
        {t('删除这条路线', 'Delete this route')}
      </button>
    </section>
  );
}
