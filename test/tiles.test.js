import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileOrder } from '../tiles.js';
import { HAND_ICONS, MOTION_ICONS } from '../icons.js';
import { HAND_SHAPES, MOTIONS, values } from '../questions.js';

test('keeps every option and puts "other" last', () => {
  for (const ids of [values(HAND_SHAPES), values(MOTIONS)]) {
    const order = tileOrder(ids);
    assert.deepEqual([...order].sort(), [...ids].sort());
    assert.equal(order.at(-1), 'other');
  }
});

test('does not always return the same order', () => {
  const ids = values(HAND_SHAPES);
  const seen = new Set(Array.from({ length: 30 }, () => tileOrder(ids).join()));
  assert.ok(seen.size > 5);
});

test('each position is reachable (no fixed first tile)', () => {
  const ids = values(MOTIONS);
  const first = new Set(Array.from({ length: 200 }, () => tileOrder(ids)[0]));
  assert.equal(first.size, ids.length - 1);
});

test('uses the given random source', () => {
  assert.deepEqual(tileOrder(['a', 'b', 'c', 'other'], () => 0), ['b', 'c', 'a', 'other']);
});

test('every hand shape and motion has a pictogram', () => {
  for (const [id] of HAND_SHAPES) assert.ok(HAND_ICONS[id]?.length > 0, id);
  for (const [id] of MOTIONS) assert.ok(MOTION_ICONS[id]?.length > 0, id);
  for (const parts of [...Object.values(HAND_ICONS), ...Object.values(MOTION_ICONS)]) {
    for (const part of parts) assert.match(part.d, /^M[\d. -]/);
  }
});
