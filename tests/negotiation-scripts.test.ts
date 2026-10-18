// The practice scripts (lib/content/negotiation-scripts.ts): every branch leads somewhere, every run
// ends in 4–6 steps, walk scores a run, and the company's hidden floor never reaches the client
// (scenarioSetting in lib/server/roleplay-scenarios.ts, nothing of the JSON in the client files).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCRIPTS, walk, type Script } from '../lib/content/negotiation-scripts';
import { SCENARIOS, scenarioSetting } from '../lib/server/roleplay-scenarios';

const CJK = /[㐀-鿿]/;
const byId = (s: Script) => new Map(s.nodes.map((n) => [n.id, n]));

void test('five scripts over their own scenarios, two kinds', () => {
  assert.deepEqual(
    SCRIPTS.map((s) => [s.id, s.scenario]),
    [
      ['salary-ask', 'rec-cloud-newgrad'],
      ['exploding-offer', 'neg-trading-exploding'],
      ['competing-offer', 'neg-cloud-newgrad'],
      ['base-to-signon', 'neg-adtech-signon'],
      ['return-plus-external', 'neg-return-intern'],
    ],
  );
  for (const s of SCRIPTS) assert.equal(s.kind, SCENARIOS.find((x) => x.id === s.scenario)!.kind, s.id);
  // Each scenario belongs to one script, and the setting it shows is in both languages.
  assert.deepEqual(SCENARIOS.map((x) => x.id).sort(), SCRIPTS.map((s) => s.scenario).sort());
  for (const x of SCENARIOS)
    for (const [zh, en] of [x.company, x.role, x.level, x.location, x.brief]) {
      assert.ok(CJK.test(zh), `${x.id}: ${zh}`);
      assert.ok(en.trim() && !CJK.test(en), `${x.id}: ${en}`);
    }
});

void test('every next exists; from the start no cycle, every node reachable, every run ends in 4–6 steps', () => {
  for (const s of SCRIPTS) {
    const nodes = byId(s);
    assert.equal(nodes.size, s.nodes.length, `${s.id}: duplicate node id`);
    for (const n of s.nodes) for (const c of n.choices) assert.ok(nodes.has(c.next), `${s.id}/${n.id} → ${c.next}`);
    // Shortest and longest run from each node, in steps; a node met again on its own path is a cycle.
    const memo = new Map<string, [number, number]>();
    const open = new Set<string>();
    const span = (id: string): [number, number] => {
      if (memo.has(id)) return memo.get(id)!;
      assert.ok(!open.has(id), `${s.id}: cycle through ${id}`);
      open.add(id);
      const kids = nodes.get(id)!.choices.map((c) => span(c.next));
      open.delete(id);
      const r: [number, number] = kids.length
        ? [1 + Math.min(...kids.map((k) => k[0])), 1 + Math.max(...kids.map((k) => k[1]))]
        : [0, 0];
      memo.set(id, r);
      return r;
    };
    const [shortest, longest] = span(s.start);
    assert.ok(shortest >= 4 && longest <= 6, `${s.id}: runs of ${shortest}–${longest} steps`);
    assert.deepEqual([...memo.keys()].sort(), [...nodes.keys()].sort(), `${s.id}: unreachable nodes`);
  }
});

void test('3–4 replies a step, at least one worth 2, branching to different nodes, all text in both languages', () => {
  for (const s of SCRIPTS) {
    const texts = [s.title];
    for (const n of s.nodes) {
      texts.push(n.line);
      if (!n.choices.length) continue;
      assert.ok(n.choices.length >= 3 && n.choices.length <= 4, `${s.id}/${n.id}: ${n.choices.length} replies`);
      assert.ok(n.choices.some((c) => c.score === 2), `${s.id}/${n.id}: no best reply`);
      for (const c of n.choices) texts.push(c.say, c.why);
    }
    // Replies lead to genuinely different places: most steps branch.
    const branching = s.nodes.filter((n) => new Set(n.choices.map((c) => c.next)).size > 1).length;
    assert.ok(branching >= s.nodes.filter((n) => n.choices.length).length / 2, `${s.id}: ${branching} branching steps`);
    for (const [zh, en] of texts) {
      assert.ok(CJK.test(zh), `${s.id}: ${zh}`);
      assert.ok(en.trim() && !CJK.test(en), `${s.id}: ${en}`);
    }
  }
});

void test('walk: the best and worst runs, and a pick out of range stops it', () => {
  for (const s of SCRIPTS) {
    for (const pickOf of [
      (scores: number[]) => scores.indexOf(2),
      (scores: number[]) => scores.indexOf(Math.min(...scores)),
    ]) {
      const picks: number[] = [];
      const nodes = byId(s);
      let at = nodes.get(s.start)!;
      let expected = 0;
      while (at.choices.length) {
        const i = pickOf(at.choices.map((c) => c.score));
        picks.push(i);
        expected += at.choices[i].score;
        at = nodes.get(at.choices[i].next)!;
      }
      const run = walk(s, [...picks, 0]);
      assert.equal(run.steps.length, picks.length, s.id);
      assert.equal(run.total, expected, s.id);
      assert.equal(run.max, picks.length * 2, s.id);
      assert.ok(run.ended && run.at === at, s.id);
    }
  }
  const s = SCRIPTS[0];
  assert.deepEqual(
    (({ total, max, ended, at }) => ({ total, max, ended, at: at.id }))(walk(s, [0, 0, 0, 0, 0])),
    { total: 10, max: 10, ended: true, at: 'end-next' },
  );
  assert.deepEqual(
    (({ total, max, ended, at }) => ({ total, max, ended, at: at.id }))(walk(s, [1, 1, 1, 1, 1])),
    { total: 0, max: 10, ended: true, at: 'end-early' },
  );
  for (const bad of [9, -1, 1.5]) {
    const run = walk(s, [0, bad, 0]);
    assert.deepEqual([run.steps.length, run.total, run.max, run.ended, run.at.id], [1, 2, 2, false, 'visa'], String(bad));
  }
  assert.deepEqual([walk(s, []).steps.length, walk(s, []).max, walk(s, []).at.id], [0, 0, 'open']);
});

void test('scenarioSetting: the setting only, a negotiation’s written offer, never the floor', () => {
  for (const s of SCRIPTS) {
    const setting = scenarioSetting(s.scenario);
    assert.ok(setting, s.scenario);
    assert.deepEqual(Object.keys(setting).sort(), (s.kind === 'negotiation' ? ['brief', 'company', 'level', 'location', 'offer', 'role'] : ['brief', 'company', 'level', 'location', 'role']), s.id);
    const json = JSON.stringify(setting);
    for (const field of ['floor', 'concessions', 'notes']) assert.ok(!json.includes(field), `${s.id}: ${field}`);
    if (setting.offer) assert.deepEqual(setting.offer, SCENARIOS.find((x) => x.id === s.scenario)!.offer);
  }
  assert.equal(scenarioSetting('rp-neg-cloud-newgrad'), null);
  assert.equal(scenarioSetting('nope'), null);
});

void test('the client files never load the scenarios, and no script names its floor', () => {
  for (const file of ['lib/content/negotiation-scripts.ts', 'components/negotiation-scripts.tsx'])
    assert.ok(!readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').includes('roleplay-scenarios'), file);
  for (const s of SCRIPTS) {
    const text = JSON.stringify(s);
    const floor = SCENARIOS.find((x) => x.id === s.scenario)!.floor;
    for (const value of Object.values(floor).filter((v): v is number => !!v)) {
      const k = value / 1000;
      const wan = String(value / 10000).replace('.', '\\.');
      for (const form of [
        new RegExp(`(?<![\\d.,])${k},000`),
        new RegExp(`(?<![\\d.,])${value}`),
        new RegExp(`(?<![\\d.,])${k}k`, 'i'),
        new RegExp(`(?<![\\d.])${wan} ?万`),
      ])
        assert.doesNotMatch(text, form, `${s.id}: ${value}`);
    }
  }
});
