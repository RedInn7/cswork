import assert from "node:assert/strict";
import test from "node:test";
import { ojImportSchema } from "../lib/oj-types";
import {
  OA_SEMANTIC_IDS,
  matchesOaSemantic,
} from "../lib/oa-semantic-checkers.mjs";
import { matchesOutput } from "../lib/server/oj-engine";
import { matchesOaOutput } from "../scripts/oa-judge/output-checker.mjs";

const checker = "oa-tree-max-path";
const input = "3\n1 2 2\n1 2\n-1 -1\n-1 -1\n";
const expected = "5\n5\n2 1 2\n1 0 2\n";
const alternate = "5\n5\n2 1 2\n2 0 1\n";

test("Uber19 alternate optimal witnesses use identical production and offline semantics", () => {
  assert.equal(OA_SEMANTIC_IDS[checker], "oa-uber-19");
  assert(matchesOaSemantic(checker, alternate, expected, input));
  for (const check of [matchesOutput, matchesOaOutput]) {
    assert(check(expected, expected, checker, input));
    assert(check(alternate, expected, checker, input));
    assert(!check("5\n5\n2 1 2\n1 0 1\n", expected, checker, input));
    // A corrupt reference must not authorize a repeated-node walk.
    assert(
      !check("5\n5\n2 1 2\n1 0 1\n", "5\n5\n2 1 2\n1 0 1\n", checker, input),
    );
  }
});

test("Uber19 fixed checker is unavailable to any other problem identity", () => {
  const payload = {
    schemaVersion: 1,
    problem: {
      id: "oa-uber-19",
      courseId: "gomall",
      lessonId: "00-overview",
      title: "Tree path",
      difficulty: "困难",
      tags: ["OA"],
      description: "Fixture",
      input: "Tree",
      output: "Four lines",
      explanation: "",
      hints: [],
      timeLimit: 3,
      memoryLimit: 262144,
      outputLimit: 8192,
      checker,
      languages: ["python"],
    },
    cases: [
      {
        name: "sample",
        input,
        expectedOutput: expected,
        hidden: false,
        weight: 1,
      },
      {
        name: "hidden",
        input,
        expectedOutput: expected,
        hidden: true,
        weight: 1,
      },
    ],
  };
  assert(ojImportSchema.safeParse(payload).success);
  payload.problem.id = "oa-uber-20";
  assert(!ojImportSchema.safeParse(payload).success);
  payload.problem.id = "ordinary-course-exercise";
  assert(!ojImportSchema.safeParse(payload).success);
});
