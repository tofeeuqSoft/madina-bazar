import Job from '../models/Job.js';
import { backoffMs } from './delivery/deliveryLogic.js';

export const enqueue = async ({ type, payload = {}, idempotencyKey = '', maxAttempts = 5, delayMs = 0 }) => {
  if (idempotencyKey) {
    const existing = await Job.findOne({ idempotencyKey });
    if (existing) return { job: existing, duplicate: true };
  }
  const job = await Job.create({
    type, payload,
    idempotencyKey: idempotencyKey || undefined,
    maxAttempts,
    runAt: new Date(Date.now() + delayMs),
  });
  return { job, duplicate: false };
};

// Atomically claim the next due job so multiple workers never double-run.
export const claimNext = async () => {
  const now = new Date();
  return Job.findOneAndUpdate(
    { status: 'PENDING', runAt: { $lte: now } },
    { $set: { status: 'RUNNING' }, $inc: { attempts: 1 } },
    { new: true, sort: { runAt: 1 } }
  );
};

export const finishJob = (job, ok, error = '') =>
  Job.findByIdAndUpdate(job._id, {
    $set: {
      status: ok ? 'DONE' : job.attempts + 1 >= job.maxAttempts ? 'FAILED' : 'PENDING',
      lastError: error,
      ...(ok ? {} : { runAt: new Date(Date.now() + backoffMs(job.attempts + 1)) }),
    },
  });

const handlers = {};

export const registerHandler = (type, fn) => {
  handlers[type] = fn;
};

export const startWorker = ({ intervalMs = 15000 } = {}) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const job = await claimNext();
      if (job) {
        const fn = handlers[job.type];
        if (!fn) {
          await finishJob(job, false, `No handler for ${job.type}`);
        } else {
          try {
            await fn(job.payload, job);
            await finishJob(job, true);
          } catch (e) {
            await finishJob(job, false, e.message);
          }
        }
      }
    } catch (e) {
      console.error('[job worker]', e.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  if (timer.unref) timer.unref();
  return { stop: () => clearInterval(timer) };
};
