'use client';
import { useEffect, useRef, useState } from 'react';
import { decisionScore } from '@/lib/offer-math';
import {
  rankingText, rankTeams, readTeamMatch, TEAM_FACTORS, TEAM_NOTES_MAX, TEAM_QUESTIONS, TEAMS_MAX, TEAMS_TARGET, teamMatchBody,
  type Team, type TeamMatch as Match,
} from '@/lib/intern-log';
import { putNote } from './problem-notes';

const GRADES = [1, 2, 3, 4, 5];
const FACTOR_NAMES = Object.fromEntries(TEAM_FACTORS.map(([id, zh, en]) => [id, [zh, en]]));

/**
 * Team-matching calls (/career/intern#team-match): one card per team with the questions asked and
 * notes, each team scored 1–5 per weighted factor, ranked by the weighted mean (offer-math's
 * decisionScore). Saved as the private note brag:teams a moment after each change.
 */
export function TeamMatch({ zh, initial }: { zh: boolean; initial: unknown }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [m, setM] = useState<Match>(() => readTeamMatch(initial));
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Saves go out one at a time, so an older body never lands after a newer one.
  const queue = useRef(Promise.resolve());
  useEffect(() => () => clearTimeout(timer.current), []);
  // ponytail: a change made in the last 800 ms before the tab closes is lost; flush on pagehide if that bites.
  const change = (next: Match) => {
    setM(next);
    setStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const body = teamMatchBody(next);
      queue.current = queue.current.then(() =>
        putNote(TEAMS_TARGET, body).then(
          () => setStatus(t('已保存到你的账号。', 'Saved to your account.')),
          (e: unknown) => setStatus((e instanceof Error && e.message) || t('保存失败，请稍后重试。', 'Couldn’t save. Try again shortly.')),
        ),
      );
    }, 800);
  };
  const putTeam = (id: string, patch: Partial<Team>) => change({ ...m, teams: m.teams.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const label = (f: { id: string; name: string }) =>
    f.name.trim() || (Object.hasOwn(FACTOR_NAMES, f.id) ? FACTOR_NAMES[f.id][zh ? 0 : 1] : t('未命名', 'Untitled'));
  const teamName = (team: Team, i: number) => team.name.trim() || t(`第 ${i + 1} 组`, `Team ${i + 1}`);
  const ranking = rankTeams(m);
  const copy = () =>
    (navigator.clipboard ? navigator.clipboard.writeText(rankingText(m, zh)) : Promise.reject(new Error('no clipboard'))).then(
      () => setStatus(t('排序已复制。', 'Ranking copied.')),
      () => setStatus(t('复制失败，请手动选中排序复制。', 'Couldn’t copy; select the ranking and copy it by hand.')),
    );

  return (
    <section id="team-match" className="intern-section" aria-labelledby="team-match-title">
      <h2 id="team-match-title">{t('选组电话', 'Team-matching calls')}</h2>
      <p className="intern-note">
        {t(
          '每通电话一张卡片：勾上问过的问题，五分钟内记下要点。先给因素定权重，再给每个组打 1–5 分，排名按加权平均，没打分的因素不算。',
          'One card per call: tick the questions you asked and write your notes within five minutes. Weight the factors, score each team 1–5, and the ranking is the weighted mean of the factors you scored.',
        )}
      </p>
      <fieldset className="intern-weights">
        <legend>{t('权重', 'Weights')}</legend>
        {m.factors.map((f, k) => (
          <label key={f.id}>
            {label(f)}
            <select
              value={f.weight}
              onChange={(e) => change({ ...m, factors: m.factors.map((x, j) => (j === k ? { ...x, weight: Number(e.target.value) } : x)) })}
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>
      <ol className="intern-teams">
        {m.teams.map((team, i) => {
          const score = decisionScore(m.factors, m.scores[team.id]);
          const name = teamName(team, i);
          return (
            <li key={team.id} className="intern-card">
              <div className="intern-card-head">
                <h3>{name}</h3>
                <output aria-label={t(`${name} 的加权得分`, `Weighted score of ${name}`)}>{score === null ? '—' : score.toFixed(2)}</output>
              </div>
              <div className="resume-form intern-grid">
                <label>
                  {t('组名', 'Team')}
                  <input value={team.name} maxLength={60} onChange={(e) => putTeam(team.id, { name: e.target.value })} />
                </label>
                <label>
                  Manager
                  <input value={team.manager} maxLength={60} onChange={(e) => putTeam(team.id, { manager: e.target.value })} />
                </label>
                <label>
                  {t('通话时间', 'Call time')}
                  <input type="datetime-local" value={team.callAt} onChange={(e) => putTeam(team.id, { callAt: e.target.value })} />
                </label>
              </div>
              <details>
                <summary>{t(`问题（已问 ${team.asked.length}/${TEAM_QUESTIONS.length}）`, `Questions (${team.asked.length}/${TEAM_QUESTIONS.length} asked)`)}</summary>
                <ul className="intern-questions">
                  {TEAM_QUESTIONS.map(([id, qzh, qen]) => (
                    <li key={id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={team.asked.includes(id)}
                          onChange={(e) =>
                            putTeam(team.id, { asked: e.target.checked ? [...team.asked, id] : team.asked.filter((q) => q !== id) })
                          }
                        />
                        <span>{zh ? qzh : qen}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
              <div className="resume-form">
                <label>
                  {t('电话笔记', 'Call notes')}
                  <textarea rows={4} value={team.notes} maxLength={TEAM_NOTES_MAX} onChange={(e) => putTeam(team.id, { notes: e.target.value })} />
                </label>
              </div>
              <fieldset className="intern-weights">
                <legend>{t('打分（1–5）', 'Scores (1–5)')}</legend>
                {m.factors.map((f) => (
                  <label key={f.id}>
                    {label(f)}
                    <select
                      value={m.scores[team.id]?.[f.id] ?? ''}
                      onChange={(e) => {
                        const row: Record<string, number> = { ...m.scores[team.id] };
                        if (e.target.value) row[f.id] = Number(e.target.value);
                        else delete row[f.id];
                        change({ ...m, scores: { ...m.scores, [team.id]: row } });
                      }}
                    >
                      <option value="">—</option>
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </fieldset>
              <div className="resume-actions">
                <button
                  type="button"
                  className="is-quiet"
                  onClick={() => {
                    if (!confirm(t(`删除「${name}」和它的笔记、打分？`, `Remove ${name} with its notes and scores?`))) return;
                    const { [team.id]: _gone, ...scores } = m.scores;
                    change({ ...m, teams: m.teams.filter((x) => x.id !== team.id), scores });
                  }}
                >
                  {t('删除这个组', 'Remove this team')}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="resume-actions">
        <button
          type="button"
          disabled={m.teams.length >= TEAMS_MAX}
          onClick={() =>
            change({
              ...m,
              teams: [...m.teams, { id: Math.random().toString(36).slice(2, 10), name: '', manager: '', callAt: '', asked: [], notes: '' }],
            })
          }
        >
          {t('添加一个组', 'Add a team')}
        </button>
        {m.teams.length >= TEAMS_MAX && <small>{t(`最多 ${TEAMS_MAX} 个组。`, `Up to ${TEAMS_MAX} teams.`)}</small>}
      </div>
      {ranking.length > 1 && (
        <div className="intern-ranking">
          <h3>{t('排名', 'Ranking')}</h3>
          <ol>
            {ranking.map(({ team, no, score }) => (
              <li key={team.id}>
                {teamName(team, no - 1)}
                {team.manager.trim() && ` (${team.manager.trim()})`}: <strong>{score === null ? t('未打分', 'not scored') : score.toFixed(2)}</strong>
              </li>
            ))}
          </ol>
          <p className="intern-note">{t('分数只是帮你理清想法，最后也听听自己的直觉。', 'The numbers help you sort out your thinking; your instinct still gets a say.')}</p>
          <div className="resume-actions">
            <button type="button" className="is-quiet" onClick={() => void copy()}>
              {t('复制排序', 'Copy the ranking')}
            </button>
          </div>
        </div>
      )}
      <p className="intern-status" role="status">
        {status}
      </p>
    </section>
  );
}
