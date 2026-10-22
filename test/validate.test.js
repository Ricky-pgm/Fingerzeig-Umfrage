import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission } from '../api/_validate.js';

const valid = () => ({
  answers: {
    consent: true,
    cooking: {
      frequency: 'weekly', device: 'tablet', position: 'leaning', distance: '50_100',
      dirtyHands: ['knuckle'], actions: ['next', 'timer'],
      dirtyHandsOther: '', actionsOther: '', annoyance: 'Bildschirm geht aus',
    },
    gestures: ['next', 'back', 'timer', 'ingredients', 'pause'].map((action, i) => ({
      action, position: i + 1, hand: 'open_palm', motion: 'swipe_left', note: '', fit: 4, ease: 5,
    })),
    accidental: '',
    about: { age: '25_39', handedness: 'right', experience: ['voice'] },
    comment: '',
  },
  contact: '',
  website: '',
  submissionId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  durationS: 480,
});

test('accepts a complete submission', () => {
  const out = validateSubmission(valid());
  assert.equal(out.answers.gestures.length, 5);
  assert.equal(out.contact, '');
});

test('rejects missing consent', () => {
  const b = valid(); b.answers.consent = false;
  assert.throws(() => validateSubmission(b));
});

test('rejects unknown fields (no name or email can sneak in)', () => {
  const b = valid(); b.answers.name = 'Max';
  assert.throws(() => validateSubmission(b));
  const c = valid(); c.answers.cooking.email = 'x@y.de';
  assert.throws(() => validateSubmission(c));
});

test('rejects values outside the lists', () => {
  const b = valid(); b.answers.cooking.device = 'fridge';
  assert.throws(() => validateSubmission(b));
  const c = valid(); c.answers.gestures[0].hand = 'claw';
  assert.throws(() => validateSubmission(c));
});

test('rejects duplicate or missing gestures', () => {
  const b = valid(); b.answers.gestures[1].action = 'next';
  assert.throws(() => validateSubmission(b));
  const c = valid(); c.answers.gestures.pop();
  assert.throws(() => validateSubmission(c));
});

test('requires a note when "other" is chosen', () => {
  const b = valid(); b.answers.gestures[0].hand = 'other';
  assert.throws(() => validateSubmission(b));
  b.answers.gestures[0].note = 'Hand wie ein Telefon';
  assert.doesNotThrow(() => validateSubmission(b));
});

test('rejects "none" combined with other experience', () => {
  const b = valid(); b.answers.about.experience = ['none', 'voice'];
  assert.throws(() => validateSubmission(b));
});

test('rejects the honeypot and over-long text', () => {
  const b = valid(); b.website = 'spam';
  assert.throws(() => validateSubmission(b));
  const c = valid(); c.answers.comment = 'x'.repeat(601);
  assert.throws(() => validateSubmission(c));
});

test('trims and keeps an optional contact', () => {
  const b = valid(); b.contact = '  mail@example.org ';
  assert.equal(validateSubmission(b).contact, 'mail@example.org');
});

test('requires a valid submission id and duration', () => {
  for (const id of [undefined, 'abc', 42, '3f2b8c1e-5a4d-0e6f-9b7a-1c2d3e4f5a6b']) {
    const b = valid(); b.submissionId = id;
    assert.throws(() => validateSubmission(b), `id ${id}`);
  }
  for (const d of [undefined, -1, 1.5, '480', 86_401]) {
    const b = valid(); b.durationS = d;
    assert.throws(() => validateSubmission(b), `duration ${d}`);
  }
  const ok = valid(); ok.submissionId = ok.submissionId.toUpperCase();
  assert.equal(validateSubmission(ok).submissionId, '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b');
});

test('requires both ratings as whole numbers from 1 to 5', () => {
  for (const key of ['fit', 'ease']) {
    for (const v of [undefined, 0, 6, 2.5, '3', null]) {
      const b = valid(); b.answers.gestures[2][key] = v;
      assert.throws(() => validateSubmission(b), `${key} ${v}`);
    }
  }
  const b = valid(); b.answers.gestures[0].fit = 1; b.answers.gestures[0].ease = 5;
  const out = validateSubmission(b);
  assert.deepEqual([out.answers.gestures[0].fit, out.answers.gestures[0].ease], [1, 5]);
});

test('rejects repeated or out-of-range positions', () => {
  const b = valid(); b.answers.gestures[1].position = 1;
  assert.throws(() => validateSubmission(b));
  const c = valid(); c.answers.gestures[4].position = 6;
  assert.throws(() => validateSubmission(c));
});
