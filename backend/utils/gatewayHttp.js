/**
 * Gateway HTTP with fail-fast timeout + safe retry.
 *
 * Rules (money safety first):
 * - Read-only calls (query/verify/validate/status): timeout + 1 retry on
 *   timeout / network error / 5xx. Retrying a read can never double-charge.
 * - Write calls (create/execute/refund-init): timeout ONLY, never auto-retry.
 *   A retried write can double-create sessions or double-refund money.
 *   Callers (reconciler / sweep cron) own write retries with idempotency keys.
 */
const DEFAULT_TIMEOUT_MS = Number(process.env.GATEWAY_TIMEOUT_MS || 15000);
const DEFAULT_RETRIES = Number(process.env.GATEWAY_RETRY || 1);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const gatewayFetch = async (url, options = {}, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 0 } = {}) => {
  let lastError = null;
  const attempts = Math.max(1, retries + 1);
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      // Retryable: gateway blew up (5xx). Never retry 4xx (our request is wrong).
      if (res.status >= 500 && i < attempts - 1) {
        lastError = new Error(`gateway ${res.status}`);
        await sleep(1000 * (i + 1));
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      // Retry only timeout / network errors, never HTTP responses already handled.
      const retryable = e?.name === 'TimeoutError' || e?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || String(e?.message || '').includes('fetch failed');
      if (!retryable || i >= attempts - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
  throw lastError;
};

// Read-only calls: timeout + 1 retry. Write calls: timeout only.
export const gatewayRead = (url, options = {}) =>
  gatewayFetch(url, options, { retries: DEFAULT_RETRIES });
export const gatewayWrite = (url, options = {}) =>
  gatewayFetch(url, options, { retries: 0 });
