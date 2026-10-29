import http from 'k6/http';
import { check } from 'k6';
import { sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const mode = __ENV.TEST_MODE || 'rubric';
const sessionSource = __ENV.SESSIONS_FILE ? open(__ENV.SESSIONS_FILE) : __ENV.SESSIONS_JSON || '[]';
const sessionValues = JSON.parse(sessionSource).filter(
  (value) => typeof value === 'string' && value.trim().length > 0,
);
const fallbackSession = __ENV.SESSION_COOKIE || '';

export const options = {
  scenarios:
    mode === 'ramp'
      ? {
          stepped_load: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
              { duration: '20s', target: 25 },
              { duration: '20s', target: 50 },
              { duration: '20s', target: 100 },
              { duration: '20s', target: 150 },
              { duration: '20s', target: 200 },
              { duration: '20s', target: 250 },
            ],
            gracefulRampDown: '10s',
            exec: 'searchRide',
            tags: { workflow: 'ride-search', phase: 'ramp' },
          },
        }
      : mode === 'stress'
        ? {
            stress_load: {
              executor: 'ramping-vus',
              startVUs: 0,
              stages: [
                { duration: '20s', target: 100 },
                { duration: '20s', target: 200 },
                { duration: '20s', target: 300 },
                { duration: '20s', target: 400 },
              ],
              gracefulRampDown: '10s',
              exec: 'searchRide',
              tags: { workflow: 'ride-search', phase: 'stress' },
            },
          }
        : {
            campus_ride_search: {
              executor: 'per-vu-iterations',
              vus: 100,
              iterations: 3,
              maxDuration: '10m',
              tags: { workflow: 'ride-search', phase: 'rubric' },
            },
          },
  thresholds: {
    http_req_failed: [mode === 'stress' ? 'rate<0.25' : 'rate<0.01'],
    'http_req_duration{workflow:ride-search}':
      mode === 'stress' ? ['p(95)<5000'] : ['p(95)<750', 'p(99)<1500'],
    checks: [mode === 'stress' ? 'rate>0.90' : 'rate>0.99'],
  },
};

function sessionCookie() {
  if (sessionValues.length === 0) return fallbackSession;
  return sessionValues[(__VU - 1) % sessionValues.length];
}

function isoWithOffset(minutesFromNow) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

export function searchRide() {
  const start = isoWithOffset(90 + __ITER * 5);
  const end = isoWithOffset(150 + __ITER * 5);
  const query =
    `direction=to_hub&hubId=${__ENV.HUB_ID || 'kanpur-central'}` +
    `&campusLocationId=${__ENV.CAMPUS_LOCATION_ID || 'hall-6'}` +
    `&departureStart=${start}&departureEnd=${end}`;
  const headers = { tags: { workflow: 'ride-search' } };
  const cookie = sessionCookie();
  if (cookie) headers.headers = { Cookie: cookie };

  const response = http.get(`${baseUrl}/rides/results?${query.toString()}`, headers);
  check(response, {
    'ride search returns HTML': (res) => res.status === 200,
  });
  sleep(mode === 'stress' ? 0.1 : 1);
}

export default function () {
  searchRide();
}
