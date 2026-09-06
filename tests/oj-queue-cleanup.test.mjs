import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Queue, Worker } from 'bullmq';
import { removeOwnTestQueueJobs } from './oj-queue-cleanup.mjs';

void test('cleanup rejects production queue names before connecting', async () => {
  await assert.rejects(
    removeOwnTestQueueJobs('cswork-judge-v1', ['job'], 'redis://invalid'),
    /test queue/,
  );
});

void test(
  'expired worker lease is removed while unowned jobs remain',
  { skip: !process.env.REDIS_URL },
  async () => {
    const name = `cswork-oj-test-cleanup-${randomUUID()}`;
    const url = new URL(process.env.REDIS_URL);
    const connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: decodeURIComponent(url.username) || undefined,
      password: decodeURIComponent(url.password) || undefined,
      db: Number(url.pathname.slice(1) || 0),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
    const queue = new Queue(name, { connection });
    const worker = new Worker(name, async () => {}, {
      connection,
      autorun: false,
      lockDuration: 1200,
    });
    let waiting = false;
    try {
      await queue.add('owned', {}, { jobId: 'owned' });
      await queue.add('unowned', {}, { jobId: 'unowned' });
      const claimed = await worker.getNextJob('cleanup-fixture-token', {
        block: false,
      });
      assert.equal(claimed.id, 'owned');
      assert.equal(await claimed.getState(), 'active');
      await worker.close(true);
      await removeOwnTestQueueJobs(
        name,
        ['owned'],
        process.env.REDIS_URL,
        () => {
          waiting = true;
        },
      );
      assert.ok(waiting, 'the real Redis lock must prevent immediate removal');
      assert.equal(await queue.getJob('owned'), undefined);
      assert.ok(
        await queue.getJob('unowned'),
        'cleanup must not remove another run’s job',
      );
      assert.equal((await queue.getJobCounts('active')).active, 0);
    } finally {
      await worker.close(true);
      // This fixture created the entire uniquely named queue and owns both jobs.
      await queue.obliterate({ force: true });
      await queue.close();
    }
  },
);
