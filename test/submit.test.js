import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/submit.js';

const body = () => ({
  answers: {
    consent: true,
    cooking: {
      frequency: 'weekly', device: 'tablet', position: 'leaning', distance: '50_100',
      dirtyHands: ['knuckle'], actions: ['next'], dirtyHandsOther: '', actionsOther: '', annoyance: '',
    },
    gestures: ['next', 'back', 'timer', 'ingredients', 'pause'].map((action, i) => ({
      action, position: i + 1, hand: 'fist', motion: 'still', note: '', fit: 3, ease: 3,
    })),
    accidental: '',
    about: { age: 'lt25', handedness: 'right', experience: ['none'] },
    comment: '',
  },
  contact: '',
  website: '',
  submissionId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  durationS: 400,
});

function call(handler, { method = 'POST', headers = { 'content-type': 'application/json' }, req = body() } = {}) {
  return new Promise((resolve) => {
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.code = code; return this; },
      json(payload) { resolve({ code: this.code, payload, headers: this.headers }); return this; },
    };
    handler({ method, headers, body: req }, res);
  });
}

test('stores a new response and answers 201', async () => {
  const saved = [];
  const h = createHandler(() => async (data) => { saved.push(data); return true; });
  const r = await call(h);
  assert.equal(r.code, 201);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].durationS, 400);
});

test('answers 200 for a repeated submission id so the client can stop retrying', async () => {
  const h = createHandler(() => async () => false);
  assert.equal((await call(h)).code, 200);
});

test('rejects wrong method, content type and invalid bodies without echoing them', async () => {
  const h = createHandler(() => async () => true);
  assert.equal((await call(h, { method: 'GET' })).code, 405);
  assert.equal((await call(h, { headers: { 'content-type': 'text/plain' } })).code, 415);
  const r = await call(h, { req: { ...body(), name: 'Max' } });
  assert.equal(r.code, 422);
  assert.deepEqual(r.payload, { error: 'invalid_submission' });
});

test('measures the parsed body, not only the content-length header', async () => {
  const h = createHandler(() => async () => true);
  const big = body(); big.answers.comment = 'x'.repeat(30_000);
  assert.equal((await call(h, { req: big })).code, 413);
});

test('answers 503 without a database and 500 when saving fails', async () => {
  assert.equal((await call(createHandler(() => null))).code, 503);
  const failing = createHandler(() => async () => { throw Object.assign(new Error('x'), { code: '42P01' }); });
  const log = console.error; console.error = () => {};
  try { assert.equal((await call(failing)).code, 500); } finally { console.error = log; }
});
