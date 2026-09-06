import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { LanguageSession } from '../scripts/language-service/broker.mjs';

// Exercise the real create/close process boundary without accessing a Docker daemon.
// The fixture exposes only a controlled executable and owns every file it creates.
async function dockerFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'cswork-lsp-lifecycle-'));
  const previousPath = process.env.PATH;
  const eventsPath = join(directory, 'events.jsonl');
  const gatePath = join(directory, 'allow-create');
  const failurePath = join(directory, 'fail-remove');
  await writeFile(eventsPath, '');
  await writeFile(
    join(directory, 'docker'),
    `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const directory = ${JSON.stringify(directory)};
const event = (name) => fs.appendFileSync(path.join(directory, 'events.jsonl'), JSON.stringify({ name, args: process.argv.slice(2) }) + '\\n');
const operation = process.argv[2];
(async () => {
  if (operation === 'create') {
    event('create-begin');
    for (let attempt = 0; !fs.existsSync(path.join(directory, 'allow-create')); attempt++) {
      if (attempt > 1000) process.exit(70);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    fs.writeFileSync(path.join(directory, 'container'), 'created');
    event('create-complete');
    process.stdout.write('fixture-container-id\\n');
  } else if (operation === 'rm') {
    if (fs.existsSync(path.join(directory, 'fail-remove'))) {
      event('remove-failed');
      process.stderr.write('Fixture daemon unavailable\\n');
      process.exitCode = 1;
    } else {
      fs.rmSync(path.join(directory, 'container'), { force: true });
      event('remove-complete');
    }
  } else {
    event('unexpected-' + operation);
    process.exitCode = 71;
  }
})();
`,
    { mode: 0o700 },
  );
  process.env.PATH = `${directory}:${previousPath || '/usr/bin:/bin'}`;
  const events = async () =>
    (await readFile(eventsPath, 'utf8'))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  return {
    events,
    releaseCreate: () => writeFile(gatePath, ''),
    failRemoval: () => writeFile(failurePath, ''),
    allowRemoval: () => rm(failurePath, { force: true }),
    async waitForCreate() {
      for (let attempt = 0; attempt < 200; attempt++) {
        if ((await events()).some((entry) => entry.name === 'create-begin'))
          return;
        await delay(10);
      }
      throw new Error('Fixture create process did not start');
    },
    async cleanup(session) {
      await writeFile(gatePath, '');
      await rm(failurePath, { force: true });
      try {
        await session?.close();
      } finally {
        if (previousPath === undefined) delete process.env.PATH;
        else process.env.PATH = previousPath;
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

const identity = {
  ownerId: 'lifecycle-fixture',
  documentId: 'problem:fixture',
  language: 'python',
};

await test('closing during Docker creation waits for creation, removes once and never attaches', async () => {
  const fixture = await dockerFixture();
  let session;
  try {
    session = new LanguageSession(identity);
    await fixture.waitForCreate();
    const closing = session.close();
    assert.equal(session.dead, true);
    assert.equal(session.close(), closing);
    assert.deepEqual(
      (await fixture.events()).map((entry) => entry.name),
      ['create-begin'],
    );
    await fixture.releaseCreate();
    await closing;
    await assert.rejects(session.ready, /Language session closed/);
    assert.deepEqual(
      (await fixture.events()).map((entry) => entry.name),
      ['create-begin', 'create-complete', 'remove-complete'],
    );
    const removal = (await fixture.events()).at(-1);
    assert.deepEqual(removal.args, ['rm', '--force', session.name]);
  } finally {
    await fixture.cleanup(session);
  }
});

await test('failed real session removal rejects safely and can be retried after Docker recovers', async () => {
  const fixture = await dockerFixture();
  let session;
  try {
    await fixture.failRemoval();
    session = new LanguageSession(identity);
    await fixture.waitForCreate();
    const rejected = assert.rejects(session.close(), (error) => {
      assert.equal(error.status, 503);
      assert.match(error.message, /cleanup pending/);
      return true;
    });
    await fixture.releaseCreate();
    await rejected;
    await assert.rejects(session.ready, /Language session closed/);
    // Allow detached startup rejection handlers to settle. node:test also fails any
    // unhandled rejection: cleanup failures must remain retryable, not crash the broker.
    await delay(20);
    assert.equal(session.dead, true);
    assert.equal(session.closing, null);
    await fixture.allowRemoval();
    await session.close();
    assert.deepEqual(
      (await fixture.events()).map((entry) => entry.name),
      ['create-begin', 'create-complete', 'remove-failed', 'remove-complete'],
    );
  } finally {
    await fixture.cleanup(session);
  }
});
