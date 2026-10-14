#!/usr/bin/env node
// One-off import of contest problem ratings from zerotrac/leetcode_problem_rating
// (https://github.com/zerotrac/leetcode_problem_rating), an MIT-licensed project that
// rates LeetCode weekly/biweekly contest problems with an Elo-style model.
// Usage: node scripts/import-lc-ratings.mjs [commit-sha]   (default: the main branch head)
// Writes lib/content/lc-ratings.json: { source, license, ratings: { [number]: { rating, contest, q } } }.
// Only numbers, contest codes and indices are kept: no titles or statements. The MIT notice
// travels with the data, as the license asks; rerun to refresh after new contests.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = 'zerotrac/leetcode_problem_rating';
const OUT = resolve(import.meta.dirname, '../lib/content/lc-ratings.json');

async function get(url, as = 'text') {
  const response = await fetch(url, { headers: { 'user-agent': 'cswork-import' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response[as]();
}

/** weekly-contest-475 → w475, biweekly-contest-12 → b12; anything else is skipped. */
export function contestCode(slug) {
  const m = /^(weekly|biweekly)-contest-(\d+)$/.exec(slug);
  return m ? `${m[1] === 'weekly' ? 'w' : 'b'}${m[2]}` : null;
}

export function convert(rows) {
  const ratings = {};
  for (const row of rows) {
    const contest = contestCode(row.ContestSlug);
    const q = Number(/^Q(\d)$/.exec(row.ProblemIndex)?.[1]);
    if (!Number.isInteger(row.ID) || !contest || !q || !Number.isFinite(row.Rating)) continue;
    ratings[row.ID] = { rating: Math.round(row.Rating), contest, q };
  }
  return ratings;
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const sha =
    process.argv[2] ||
    JSON.parse(await get(`https://api.github.com/repos/${REPO}/commits/main`)).sha;
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`not a commit sha: ${sha}`);
  const raw = `https://raw.githubusercontent.com/${REPO}/${sha}`;
  const license = (await get(`${raw}/LICENSE`)).trim();
  // Refuse to import if the license is no longer MIT: then the data needs a fresh review.
  if (!/^MIT License\b/.test(license) || !/Permission is hereby granted, free of charge/.test(license))
    throw new Error('LICENSE is no longer MIT; review before importing');
  const ratings = convert(JSON.parse(await get(`${raw}/data.json`)));
  const data = {
    source: `https://github.com/${REPO} (data.json at ${sha}). Ratings of LeetCode weekly and biweekly contest problems computed by zerotrac from contest results; contests 1–62 are not rated.`,
    license,
    ratings,
  };
  // One rating per line, so a refresh diffs by problem.
  const lines = Object.entries(ratings).map(([n, r]) => `    ${JSON.stringify(n)}: ${JSON.stringify(r)}`);
  writeFileSync(
    OUT,
    `{\n  "source": ${JSON.stringify(data.source)},\n  "license": ${JSON.stringify(license)},\n  "ratings": {\n${lines.join(',\n')}\n  }\n}\n`,
  );
  console.log(`${Object.keys(ratings).length} ratings → ${OUT}`);
}
