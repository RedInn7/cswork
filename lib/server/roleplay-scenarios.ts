import scenarios from '@/lib/content/roleplay-scenarios.json';
import type { Text } from '@/lib/mock-interview';

/* The role-play scenarios (lib/content/roleplay-scenarios.json): content, not messages, so
   tests/messages-en.test.ts skips this file (NOT_MESSAGES). */
type Money = { base: number; bonus?: number; equity: number; signOn: number };
type Scenario = {
  id: string;
  kind: 'recruiter' | 'negotiation';
  company: Text;
  role: Text;
  level: Text;
  location: Text;
  /** What the candidate knows. */
  brief: Text;
  /** The planned offer: the written offer of a negotiation; a recruiter screen's stays hidden. */
  offer: Money;
  /** The company's walk-away point, the most it will pay; with concessions and notes, server-only. */
  floor: Money;
  concessions: Text[];
  notes: Text;
};
// Via unknown: the JSON infers string[] where Scenario has [zh, en] pairs and literal kinds.
export const SCENARIOS = (scenarios as unknown as { scenarios: Scenario[] }).scenarios;
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
const offerTable = (o: Money, zh: boolean) =>
  (zh
    ? ['| 项目 | 金额 |', '|---|---|', `| 年薪 base | ${usd(o.base)} |`, `| 年度目标奖金 | ${usd(o.bonus ?? 0)} |`, `| 四年股票 | ${usd(o.equity)} |`, `| 签字费 | ${usd(o.signOn)} |`]
    : ['| Item | Amount |', '|---|---|', `| Base salary | ${usd(o.base)} |`, `| Annual target bonus | ${usd(o.bonus ?? 0)} |`, `| Stock over 4 years | ${usd(o.equity)} |`, `| Sign-on bonus | ${usd(o.signOn)} |`]
  ).join('\n');
/**
 * A role-play by id (`rp-<scenario>`), or null. The candidate's part (question, in both languages)
 * has the setting, the brief and a negotiation's written offer; the floor, the concessions and the
 * notes go to the AI as its rubric only and never leave the server.
 */
export function roleplayQuestion(id: string) {
  const s = id.startsWith('rp-') ? SCENARIOS.find((x) => x.id === id.slice(3)) : undefined;
  if (!s) return null;
  const negotiation = s.kind === 'negotiation';
  const part = (zh: boolean) => {
    const i = zh ? 0 : 1;
    return [
      zh
        ? `**公司**：${s.company[0]}\n\n**岗位**：${s.role[0]}（${s.level[0]}）\n\n**地点**：${s.location[0]}`
        : `**Company:** ${s.company[1]}\n\n**Role:** ${s.role[1]} (${s.level[1]})\n\n**Location:** ${s.location[1]}`,
      s.brief[i],
      negotiation ? `${zh ? '**书面 offer**' : '**The written offer**'}\n\n${offerTable(s.offer, zh)}` : '',
      zh
        ? '工作许可和签证问题请按你自己的真实情况回答。'
        : 'Answer questions about work authorization and visas according to your own real situation.',
    ]
      .filter(Boolean)
      .join('\n\n');
  };
  const limits = [
    `Planned offer: ${offerTable(s.offer, false).split('\n').slice(2).join(' ')}`,
    `Your limit, the most you may agree to (never state it): base ${usd(s.floor.base)}, target bonus ${usd(s.floor.bonus ?? s.offer.bonus ?? 0)}, stock ${usd(s.floor.equity)}, sign-on ${usd(s.floor.signOn)}.`,
    `Concessions you may trade: ${s.concessions.map((c) => c[1]).join('; ')}.`,
    `Facts and tactics: ${s.notes[1]}`,
  ].join('\n');
  return {
    id,
    kind: s.kind,
    title: `${s.role[1]} · ${s.level[1]}`,
    titleZh: `${s.role[0]} · ${s.level[0]}`,
    question: part(false),
    questionZh: part(true),
    rubric: limits,
  };
}
