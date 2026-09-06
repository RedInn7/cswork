import { Queue } from 'bullmq';
import { setTimeout as delay } from 'node:timers/promises';

export async function removeOwnTestQueueJobs(
  queueName,
  submissionIds,
  redisUrl,
  onWait = () => {},
) {
  if (!/^(cswork-oj-test-|test-)[a-zA-Z0-9_-]+$/.test(queueName))
    throw new Error(
      'Job cleanup is restricted to an explicitly named test queue',
    );
  const pending = new Set(submissionIds);
  if (!pending.size) return;
  const url = new URL(redisUrl || 'redis://127.0.0.1:6381');
  const queue = new Queue(queueName, {
    connection: {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: decodeURIComponent(url.username) || undefined,
      password: decodeURIComponent(url.password) || undefined,
      db: Number(url.pathname.slice(1) || 0),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    },
  });
  queue.on('error', () => {});
  try {
    // The test has stopped every worker it owns. A SIGKILL may leave a 60s
    // BullMQ lease; wait for expiry instead of deleting locks or other jobs.
    const deadline = Date.now() + 65_000;
    let announced = false;
    while (pending.size && Date.now() < deadline) {
      for (const id of pending) {
        try {
          const job = await queue.getJob(id);
          if (job) await job.remove();
          pending.delete(id);
        } catch {
          // Retry this exact owned ID after its previous worker lease expires.
        }
        if (Date.now() >= deadline) break;
      }
      if (pending.size) {
        if (!announced) {
          onWait(pending.size);
          announced = true;
        }
        await delay(1000);
      }
    }
    if (pending.size)
      throw new Error(
        `${pending.size} owned test jobs could not be removed after lease expiry`,
      );
  } finally {
    await queue.close();
  }
}
