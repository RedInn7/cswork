import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  curatedEntries,
  curatedSections,
  LING_CURATED_ID,
} from "../lib/ling-curated";
import {
  OTHER_SECTION,
  ROUTE_SECTIONS,
  routeStops,
  STOP_NAMES,
} from "../lib/route-stops";
const dir = mkdtempSync(resolve(tmpdir(), "ling-selected-test-"));
process.env.DATABASE_PATH = resolve(dir, "test.sqlite");
const { sqlite } = await import("../db/sqlite");
const { listStudyLibrary, getStudyLibrary } =
  await import("../lib/server/study-library");
const selected = (query = "", userId?: string) => {
  const result = listStudyLibrary(
    new URLSearchParams(`collection=${LING_CURATED_ID}&${query}`),
    userId,
  );
  assert.ok("collection" in result);
  return result;
};
before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve("drizzle") });
  const insert = sqlite()
    .prepare(`INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,imported_at)
    VALUES(?,?,?,?,?,'中等','[]',?,'source',0,0,1)`);
  for (const { number } of [...curatedEntries, { number: 999999 }])
    insert.run(
      `lc-${number}`,
      number,
      `fixture-${number}`,
      `题目[${number}]`,
      `Problem ${number}`,
      JSON.stringify({
        descriptionZh: "题面",
        descriptionEn: "Statement",
        sourceUrl: "https://leetcode.cn/problems/test/",
        sourceEnUrl: "https://leetcode.com/problems/test/",
        attribution: "test",
        signature: {},
        reference: { path: "/private/reference.py" },
        cases: [{ input: "HIDDEN-MARKER" }],
      }),
    );
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});
void test("curation is exactly 500 unique, individually explained, staged problems", () => {
  assert.equal(curatedEntries.length, 500);
  assert.equal(new Set(curatedEntries.map((e) => e.number)).size, 500);
  for (const entry of curatedEntries) {
    assert.ok(Number.isInteger(entry.number) && entry.number > 0);
    assert.match(entry.sectionSlug, /^[a-z][a-z0-9-]+$/);
    assert.ok(entry.sectionTitle.length > 0);
    assert.ok(entry.sectionTitleEn.length > 0);
    assert.ok(entry.reason.length >= 8);
    assert.ok(entry.reasonEn.length >= 20);
    assert.doesNotMatch(entry.reasonEn, /[\u3400-\u9fff]/);
    assert.ok(["基础", "核心", "进阶"].includes(entry.stage));
    assert.equal(
      entry.stageEn,
      { 基础: "Foundation", 核心: "Core", 进阶: "Advanced" }[entry.stage],
    );
  }
  assert.equal(curatedSections.length, 35);
  assert.equal(new Set(curatedSections.map((s) => s.titleEn)).size, 35);
  assert.equal(new Set(curatedEntries.map((e) => e.reasonEn)).size, 500);
  for (const section of curatedSections)
    for (const entry of curatedEntries.filter(
      (e) => e.sectionSlug === section.slug,
    ))
      assert.equal(entry.sectionTitleEn, section.titleEn);
});
void test("bilingual metadata preserves the original 500 selections, order, stages and Chinese explanations", () => {
  const original = curatedEntries.map((entry) => ({
    number: entry.number,
    sectionSlug: entry.sectionSlug,
    sectionTitle: entry.sectionTitle,
    stage: entry.stage,
    reason: entry.reason,
  }));
  assert.equal(
    createHash("sha256").update(JSON.stringify(original)).digest("hex"),
    "a407696f3075d6123fa4e11eee72868d4df2e39a33538a133a9bcc7488430160",
  );
});
void test("collection keeps study order across pagination and excludes all-library extras", () => {
  const first = selected(),
    second = selected("page=2");
  assert.equal(first.total, 500);
  assert.equal(first.collection.available, 500);
  assert.equal(first.collection.ready, 0);
  assert.deepEqual(
    [...first.items, ...second.items].map((i) => i.number),
    curatedEntries.slice(0, 60).map((e) => e.number),
  );
  assert.equal(selected("q=999999").total, 0);
  assert.equal(
    listStudyLibrary(new URLSearchParams("collection=all&q=999999")).total,
    1,
  );
  assert.throws(() =>
    listStudyLibrary(new URLSearchParams("collection=unknown")),
  );
  for (const value of [
    first,
    getStudyLibrary(`lc-${curatedEntries[0].number}`),
  ])
    for (const secret of ["HIDDEN-MARKER", "/private/reference.py"])
      assert.ok(!JSON.stringify(value).includes(secret));
});
void test("every curated section is one named stop in exactly one route group", () => {
  for (const { slug } of curatedSections) {
    assert.ok(Object.hasOwn(STOP_NAMES, slug), slug);
    assert.equal(
      ROUTE_SECTIONS.filter((group) => group.slugs.includes(slug)).length,
      1,
      slug,
    );
  }
  assert.equal(Object.keys(STOP_NAMES).length, curatedSections.length);
  // Groups follow the curriculum order, so each one is a single run on the line.
  const { stops, runs } = routeStops(selected().collection.sections);
  assert.deepEqual(
    runs.map(({ en, span }) => [en, span]),
    ROUTE_SECTIONS.map(({ en, slugs }) => [en, slugs.length]),
  );
  assert.equal(stops[34].code, "35");
});
void test("route stops keep server order, group contiguous runs and fall back for unknown slugs", () => {
  const section = (slug: string, title = slug, titleEn?: string) => ({
    slug,
    title,
    titleEn,
    total: 2,
    solved: 1,
  });
  const { stops, runs } = routeStops([
    section("array-foundations"),
    section("hash-counting"),
    section("array", "数组", "Arrays"),
    section("toString", "谜"),
    section("linked-list"),
    section("graph-connectivity"),
  ]);
  assert.deepEqual(
    stops.map((s) => [s.code, s.index, s.start, s.group.en]),
    [
      ["01", 0, true, "Linear Structures"],
      ["02", 1, false, "Linear Structures"],
      ["03", 2, true, "Other"],
      ["04", 3, false, "Other"],
      ["05", 4, true, "Lists & Trees"],
      ["06", 5, true, "Graphs"],
    ],
  );
  assert.deepEqual(runs, [
    { zh: "线性结构", en: "Linear Structures", from: 0, span: 2 },
    { ...OTHER_SECTION, from: 2, span: 2 },
    { zh: "链表与树", en: "Lists & Trees", from: 4, span: 1 },
    { zh: "图论", en: "Graphs", from: 5, span: 1 },
  ]);
  assert.deepEqual(
    [stops[0].shortZh, stops[0].shortEn],
    ["原地数组", "In-place Arrays"],
  );
  assert.deepEqual(
    [stops[2].shortZh, stops[2].shortEn, stops[2].titleEn],
    ["数组", "Arrays", "Arrays"],
  );
  assert.deepEqual(
    [stops[3].shortZh, stops[3].shortEn, stops[3].titleEn],
    ["谜", "谜", "谜"],
  );
  assert.deepEqual(routeStops([]), { stops: [], runs: [] });
});
void test("section, stage, search, difficulty and progress filters compose", () => {
  const entry = curatedEntries[0];
  const result = selected(
    `section=${entry.sectionSlug}&stage=${encodeURIComponent(entry.stage)}`,
  );
  assert.equal(
    result.total,
    curatedEntries.filter(
      (e) => e.sectionSlug === entry.sectionSlug && e.stage === entry.stage,
    ).length,
  );
  assert.equal(
    selected(
      `q=${encodeURIComponent(`[${entry.number}]`)}&difficulty=${encodeURIComponent("中等")}`,
    ).total,
    1,
  );
  assert.equal(selected("status=solved").total, 0);
  assert.equal(selected("status=todo").total, 500);
});
void test("progress is user scoped, counts judge acceptance once, and preserves readiness checks", () => {
  const number = curatedEntries[0].number,
    id = `lc-${number}`,
    otherId = `lc-${curatedEntries[1].number}`;
  sqlite()
    .prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview','curated-v1',1,1,1)`,
    )
    .run(id);
  sqlite()
    .prepare(
      `INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES('curated-v1',?,1,'{}','hash','teacher',1)`,
    )
    .run(id);
  sqlite()
    .prepare(
      `UPDATE study_library SET judge_problem_id=id,verified_hash=content_hash || ':curated-v1' WHERE id=?`,
    )
    .run(id);
  sqlite()
    .prepare("UPDATE study_library SET judge_problem_id=id WHERE id=?")
    .run(otherId);
  const submit = sqlite().prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode) VALUES(?,?,?,'python','',?,1,1,1,?)`,
  );
  submit.run("a", "alice", id, "accepted", "judge");
  submit.run("a2", "alice", id, "accepted", "judge");
  submit.run("b", "bob", otherId, "accepted", "judge");
  submit.run("custom", "alice", otherId, "accepted", "run");
  assert.equal(selected("", "alice").collection.solved, 1);
  assert.equal(selected("", "bob").collection.solved, 1);
  assert.equal(selected().collection.solved, 0);
  assert.deepEqual(
    selected("status=solved", "alice").items.map((i) => i.id),
    [id],
  );
  assert.equal(selected("status=ready", "alice").total, 1);
  // next is the problem nextProblemId points to; guests get the first judgeable one.
  for (const [userId, expected] of [
    ["bob", id],
    ["alice", null],
  ] as const) {
    const result = selected("", userId);
    assert.equal(result.nextProblemId, expected);
    assert.equal(result.next?.judgeProblemId ?? null, expected);
  }
  assert.equal(selected().nextProblemId, null);
  assert.deepEqual(selected().next, {
    judgeProblemId: id,
    number,
    titleZh: `题目[${number}]`,
    titleEn: `Problem ${number}`,
    difficulty: "中等",
    sectionSlug: curatedEntries[0].sectionSlug,
    stage: curatedEntries[0].stage,
  });
  sqlite()
    .prepare("UPDATE study_library SET verified_hash=NULL WHERE id=?")
    .run(id);
  assert.equal(selected("status=ready", "alice").total, 0);
  assert.equal(selected("", "alice").collection.solved, 1);
});
void test("independent rounds preserve history, isolate users and ignore runs", async () => {
  const { changePracticeRound, practiceRoundState } =
    await import("../lib/server/practice-rounds");
  const first = practiceRoundState("alice");
  assert.equal(first.currentRound.number, 1);
  assert.equal(first.rounds[0].solved, 1);
  const second = changePracticeRound("alice", {
    action: "create",
    idempotencyKey: "round-create-key-0001",
  });
  assert.equal(second.currentRound.number, 2);
  assert.equal(selected("", "alice").collection.solved, 0);
  assert.equal(
    changePracticeRound("alice", {
      action: "create",
      idempotencyKey: "round-create-key-0001",
    }).rounds.length,
    2,
  );
  assert.throws(
    () =>
      changePracticeRound("bob", {
        action: "activate",
        roundId: second.activeRoundId,
      }),
    /不存在/,
  );
  sqlite()
    .prepare(`UPDATE submissions SET practice_round_id=? WHERE id='custom'`)
    .run(second.activeRoundId);
  assert.equal(selected("", "alice").collection.solved, 0);
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode,practice_round_id) VALUES('round2-ac','alice',?,'python','','accepted',1,2,2,'judge',?)`,
    )
    .run(`lc-${curatedEntries[1].number}`, second.activeRoundId);
  assert.equal(selected("", "alice").collection.solved, 1);
  changePracticeRound("alice", {
    action: "activate",
    roundId: first.activeRoundId,
  });
  assert.deepEqual(
    selected("status=solved", "alice").items.map((i) => i.id),
    [`lc-${curatedEntries[0].number}`],
  );
  assert.equal(
    changePracticeRound("alice", {
      action: "create",
      idempotencyKey: "round-create-key-0001",
    }).activeRoundId,
    first.activeRoundId,
  );
  assert.equal(practiceRoundState("alice").rounds[1].solved, 1);
  assert.equal(listStudyLibrary(new URLSearchParams("q=999999")).total, 0);
});
void test("section stage counts add up to the section counts", () => {
  for (const userId of [undefined, "alice"]) {
    const { collection, next, nextProblemId } = selected("", userId);
    assert.equal(nextProblemId, null);
    // Nothing is judgeable any more: guests still get the first stop of the line.
    assert.equal(next?.number ?? null, userId ? null : curatedEntries[0].number);
    assert.equal(
      collection.sections.reduce((sum, s) => sum + s.total, 0),
      500,
    );
    for (const section of collection.sections) {
      const stages = Object.values(section.stages);
      assert.equal(stages.length, 3);
      assert.equal(
        stages.reduce((sum, s) => sum + s.total, 0),
        section.total,
      );
      assert.equal(
        stages.reduce((sum, s) => sum + s.solved, 0),
        section.solved,
      );
    }
  }
});
