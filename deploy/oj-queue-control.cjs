// Deployment only: credentials come from Node --env-file, never arguments/output.
const { createRequire } = require('node:module');
const runtime = createRequire('/srv/cswork/current/oj-worker/index.mjs');
const { Queue } = runtime('bullmq');
const Redis = runtime('ioredis');
const action = process.argv[2];
if (!['pause', 'resume', 'status'].includes(action)) process.exit(2);
const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
const queue = new Queue(process.env.OJ_QUEUE_NAME || 'cswork-judge-v1', { connection });
(async () => {
  try {
    if (action === 'pause') {
      await queue.pause();
      const deadline = Date.now() + 240_000;
      while (await queue.getActiveCount()) {
        if (Date.now() >= deadline) throw new Error('Active judge jobs did not drain');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else if (action === 'resume') await queue.resume();
    console.log(JSON.stringify({ paused: await queue.isPaused(), active: await queue.getActiveCount(), waiting: await queue.getWaitingCount() }));
  } finally {
    await queue.close();
    await connection.quit();
  }
})().catch(() => { console.error('Judge queue operation failed'); process.exitCode = 1; });
