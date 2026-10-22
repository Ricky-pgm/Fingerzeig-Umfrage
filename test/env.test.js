import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseUrl } from '../api/_env.js';

test('prefers the plain variable', () => {
  assert.equal(databaseUrl({ DATABASE_URL: 'a', x_DATABASE_URL: 'b' }), 'a');
});

test('falls back to a prefixed pooled variable', () => {
  const env = { x_DATABASE_URL_UNPOOLED: 'u', x_DATABASE_URL: 'p' };
  assert.equal(databaseUrl(env), 'p');
});

test('returns undefined when nothing is set', () => {
  assert.equal(databaseUrl({}), undefined);
});
