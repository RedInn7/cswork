/** One-off: drop draft packages that duplicate the current published version. Dry run unless --apply. */
import { sqlite } from '../db/sqlite';
import {
  PUBLISHED_DRAFT_PAYLOAD,
  problemChecksum,
  validateProblemPackage,
} from '../lib/server/oj-problems';

const apply = process.argv.includes('--apply');
const db = sqlite();
const ids = db
  .prepare(
    'SELECT d.problem_id AS id FROM oj_problem_drafts d JOIN oj_problems p ON p.id=d.problem_id WHERE p.current_version_id IS NOT NULL AND d.payload_json<>?',
  )
  .all(PUBLISHED_DRAFT_PAYLOAD) as { id: string }[];
const read = db.prepare(
  'SELECT d.payload_json AS payload,d.revision,v.checksum,length(d.payload_json) AS bytes FROM oj_problem_drafts d JOIN oj_problems p ON p.id=d.problem_id JOIN oj_problem_versions v ON v.id=p.current_version_id WHERE d.problem_id=?',
);
// Same revision and payload guard as publishing: a draft edited meanwhile is left alone.
const strip = db.prepare(
  'UPDATE oj_problem_drafts SET payload_json=?,revision=revision+1,updated_at=? WHERE problem_id=? AND revision=? AND payload_json=?',
);
let stripped = 0,
  kept = 0,
  bytes = 0;
for (const { id } of ids) {
  const row = read.get(id) as
    | { payload: string; revision: number; checksum: string; bytes: number }
    | undefined;
  if (!row) continue;
  let same = false;
  try {
    same =
      problemChecksum(validateProblemPackage(JSON.parse(row.payload))) ===
      row.checksum;
  } catch {
    // An invalid draft is never identical to a published version; leave it.
  }
  if (!same) {
    kept++;
    continue;
  }
  if (apply)
    strip.run(PUBLISHED_DRAFT_PAYLOAD, Date.now(), id, row.revision, row.payload);
  stripped++;
  bytes += row.bytes;
}
console.log(
  JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    identicalToPublished: stripped,
    unpublishedEditsKept: kept,
    payloadMiB: Math.round(bytes / 1048576),
  }),
);
