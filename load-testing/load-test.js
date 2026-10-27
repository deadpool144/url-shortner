// loadtest.js
//
// Run examples:
//   k6 run loadtest.js
//   k6 run -e SEED_COUNT=10000 loadtest.js
//   k6 run -e BASE_URL=http://localhost:8080/api/v1/url loadtest.js
//
// For a fair Redis vs no-Redis comparison: same script, same env values,
// same DB state (truncate `urls` AND reset the Redis counter together),
// app restarted before each run.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// ---------------- CONFIGURATION ----------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api/v1/url';
const SEED_COUNT = parseInt(__ENV.SEED_COUNT || '5000', 10);
const BATCH_SIZE = 50;

// Redirect rate steps (requests/s): start at 100, then up to 2000.
const START_RATE = 100;
const RATE_STEPS = [250, 500, 1000, 2200];

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

// Log at most this many failures per VU (k6 gives each VU its own copy).
const MAX_FAILURE_LOGS_PER_VU = 1;
let failureLogs = 0;

// Counts failures by cause, so the end-of-test summary explains them.
const failuresByCause = new Counter('failures_by_cause');

// ---------------- OPTIONS ----------------

// Hold 100 req/s first, then ramp to each step and hold it.
// Each level gets 10s to ramp and 30s to hold, so p95 per level is readable.
const rampStages = [{ duration: '30s', target: START_RATE }];
RATE_STEPS.forEach((rate) => {
  rampStages.push({ duration: '10s', target: rate }); // ramp up
  rampStages.push({ duration: '30s', target: rate }); // hold
});

export const options = {
  setupTimeout: '5m',

  scenarios: {
    create: {
      executor: 'ramping-vus',
      exec: 'createUrl',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 10 },
        { duration: '2m40s', target: 10 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },

    redirect: {
      executor: 'ramping-arrival-rate',
      exec: 'redirectUrl',
      startRate: START_RATE,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 1000,
      stages: rampStages,
    },
  },

  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:create}': ['p(95)<500'],
    'http_req_duration{name:redirect}': ['p(95)<200'],
    dropped_iterations: ['count<1000'],
  },
};

// ---------------- HELPERS ----------------

function getShortUrl(res) {
  try {
    const body = JSON.parse(res.body);
    return body.shortUrl || body.ShortUrl || undefined;
  } catch (_) {
    return undefined;
  }
}

// Accepts either a bare code ("aB3") or a full short URL (".../aB3").
function extractCode(value) {
  if (!value) return undefined;
  const str = String(value).trim();
  if (!str.includes('://')) return str;
  const clean = str.split(/[?#]/)[0];
  const parts = clean.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : undefined;
}

function classify(res) {
  if (res.status === 0) return `status0:${res.error_code || 'unknown'}`;
  return `http${res.status}`;
}

function logFailure(type, res, extra = {}) {
  failuresByCause.add(1, { type, cause: classify(res) });

  if (failureLogs >= MAX_FAILURE_LOGS_PER_VU) return;
  failureLogs++;

  console.error(
      JSON.stringify({
        type,
        status: res.status,
        error: res.error || '',
        error_code: res.error_code || 0,
        body: String(res.body || '').slice(0, 200),
        ...extra,
      })
  );
}

// ---------------- SEED DATA ----------------

export function setup() {
  const codes = [];
  let failedSeeds = 0;
  let lastFailure = null;

  for (let i = 0; i < SEED_COUNT; i += BATCH_SIZE) {
    const count = Math.min(BATCH_SIZE, SEED_COUNT - i);
    const requests = [];

    for (let j = 0; j < count; j++) {
      const uniqueId = `${i + j}-${Date.now()}-${Math.random()}`;
      requests.push([
        'POST',
        `${BASE_URL}/create-shortUrl`,
        JSON.stringify({ url: `https://www.example.com/seed-${uniqueId}` }),
        { ...JSON_HEADERS, tags: { name: 'seed' } },
      ]);
    }

    for (const res of http.batch(requests)) {
      const code = res.status === 200 ? extractCode(getShortUrl(res)) : undefined;
      if (code) {
        codes.push(code);
      } else {
        failedSeeds++;
        lastFailure = `status=${res.status} error=${res.error || ''} body=${String(res.body || '').slice(0, 200)}`;
      }
    }
  }

  console.log(`Seeding: expected=${SEED_COUNT}, valid=${codes.length}, failed=${failedSeeds}`);

  // Never benchmark redirects against a partial dataset.
  if (codes.length !== SEED_COUNT) {
    throw new Error(
        `Seeding failed (${codes.length}/${SEED_COUNT}). Last failure: ${lastFailure}. ` +
        `If this is a unique-constraint error, clear the urls table and reset the Redis counter together.`
    );
  }

  return { codes };
}

// ---------------- CREATE SCENARIO ----------------

export function createUrl() {
  const payload = JSON.stringify({
    url: `https://www.example.com/page-${__VU}-${__ITER}-${Date.now()}-${Math.random()}`,
  });

  const res = http.post(`${BASE_URL}/create-shortUrl`, payload, {
    ...JSON_HEADERS,
    tags: { name: 'create' },
  });

  const validStatus = res.status === 200;
  const hasShortUrl = Boolean(getShortUrl(res));

  check(res, {
    'create status is 200': () => validStatus,
    'has shortUrl': () => hasShortUrl,
  });

  if (!validStatus || !hasShortUrl) logFailure('create', res);

  sleep(0.5);
}

// ---------------- REDIRECT SCENARIO ----------------

// 80% of traffic goes to the first 20% of codes (hot links).
function pickCode(codes) {
  const hotSize = Math.max(1, Math.floor(codes.length * 0.2));
  if (Math.random() < 0.8) {
    return codes[Math.floor(Math.random() * hotSize)];
  }
  return codes[hotSize + Math.floor(Math.random() * (codes.length - hotSize))];
}

export function redirectUrl(data) {
  if (!data || !data.codes || data.codes.length === 0) {
    throw new Error('No seeded URL codes available');
  }

  const code = pickCode(data.codes);

  const res = http.get(`${BASE_URL}/${encodeURIComponent(code)}`, {
    redirects: 0, // don't follow, or you'd load-test the destination site
    tags: { name: 'redirect' },
  });

  const validStatus = res.status === 302;
  const hasLocation = Boolean(res.headers['Location']);

  check(res, {
    'redirect status is 302': () => validStatus,
    'has Location header': () => hasLocation,
  });

  if (!validStatus || !hasLocation) logFailure('redirect', res, { code });
}