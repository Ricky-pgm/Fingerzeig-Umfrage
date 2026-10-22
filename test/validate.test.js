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
      action, position: i + 1, hand: 'open_palm', motion: 'swipe_left', note: '',
    })),
    accidental: '',
    about: { age: '25_39', handedness: 'right', experience: ['voice'] },
    comment: '',
  },
  contact: '',
  website: '',
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
