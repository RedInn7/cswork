/** One source of truth for authored reference language and hash-bound source. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readBoundedFileSync } from './bounded-file.mjs';
import { OA_MAX_METADATA_FILE_BYTES } from '../../lib/oj-data-budgets.mjs';

const extensions = Object.freeze({ python: '.py', cpp: '.cpp' });
export function referenceExtension(language) {
  assert(
    typeof language === 'string' && Object.hasOwn(extensions, language),
    'Unsupported OA reference language: ' + language,
  );
  return extensions[language];
}
export function referenceProgram(entry, source) {
  assert(/^oa-[a-z0-9-]+$/.test(entry.id), 'Invalid reference identity');
  assert.equal(
    entry.authoredSolutions?.length,
    1,
    'Every exposed program must be verified',
  );
  const { language, code } = entry.authoredSolutions[0];
  const extension = referenceExtension(language);
  assert.equal(typeof code, 'string');
  assert.equal(source, code, 'Exposed solution must match verified program');
  return {
    language,
    extension,
    code,
    sha256: createHash('sha256').update(source).digest('hex'),
  };
}
export function readReferenceProgram(root, entry) {
  assert(/^oa-[a-z0-9-]+$/.test(entry.id), 'Invalid reference identity');
  assert.equal(
    entry.authoredSolutions?.length,
    1,
    'Every exposed program must be verified',
  );
  const extension = referenceExtension(entry.authoredSolutions[0].language);
  const bytes = readBoundedFileSync(
    resolve(root, 'references', entry.id + extension),
    OA_MAX_METADATA_FILE_BYTES,
  );
  const source = bytes.toString('utf8');
  assert(
    Buffer.from(source, 'utf8').equals(bytes),
    'Reference source must be valid UTF-8',
  );
  return referenceProgram(entry, source);
}
export function assertReferenceEvidence(evidence, program) {
  // Pre-native reports omitted the language and verified Python only.
  assert.equal(
    Object.hasOwn(evidence, 'referenceLanguage')
      ? evidence.referenceLanguage
      : 'python',
    program.language,
    'Reference language evidence mismatch',
  );
  assert.equal(
    evidence.referenceSha256,
    program.sha256,
    'Stale reference source evidence',
  );
}
export function mutantProgram(mutant, reference) {
  assert(
    typeof mutant.name === 'string' &&
      mutant.name &&
      typeof mutant.code === 'string' &&
      mutant.code,
  );
  const language = Object.hasOwn(mutant, 'language')
    ? mutant.language
    : reference.language;
  return {
    language,
    extension: referenceExtension(language),
    code: mutant.code,
  };
}
