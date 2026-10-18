import scenarios from '@/lib/content/roleplay-scenarios.json';
import type { Setting, Text } from '@/lib/content/negotiation-scripts';

/* The negotiation practice scripts' scenarios (lib/content/roleplay-scenarios.json): content, not
   messages, so tests/messages-en.test.ts skips this file (NOT_MESSAGES). */
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
/** What the candidate sees of a scenario (the practice scripts' setting card): never the floor, concessions or notes. */
export function scenarioSetting(id: string): Setting | null {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) return null;
  const { company, role, level, location, brief } = s;
  return { company, role, level, location, brief, ...(s.kind === 'negotiation' && { offer: { ...s.offer } }) };
}
