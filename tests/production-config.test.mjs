import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Isolated processes exercise the actual environment and singleton initialization.
// No test ever opens a remote database connection.
function run(source, overrides = {}) {
  const env = { ...process.env, NODE_ENV: 'production' };
  for (const key of ['DATABASE_URL', 'SESSION_SECRET', 'ALLOW_IN_MEMORY_DB', 'VERCEL']) delete env[key];
  return spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: new URL('..', import.meta.url), env: { ...env, ...overrides }, encoding: 'utf8',
  });
}

const database = `const { getDb } = await import('./src/lib/server/db.ts'); getDb();`;
const session = `const { createSessionValue, verifySessionValue } = await import('./src/lib/server/auth.ts');
  const value = createSessionValue('production-config');
  if (!verifySessionValue(value, 'production-config')) process.exit(1);
  console.log(value);`;

test('production refuses to accept progress without a persistent database', () => {
  const result = run(database);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DATABASE_URL is required in production/);
});

test('local production-build tests can explicitly use an isolated memory database', () => {
  const result = run(database, { ALLOW_IN_MEMORY_DB: '1' });
  assert.equal(result.status, 0, result.stderr);
  const hosted = run(database, { ALLOW_IN_MEMORY_DB: '1', VERCEL: '1' });
  assert.notEqual(hosted.status, 0);
  assert.match(hosted.stderr, /DATABASE_URL is required in production/);
});

test('development and unit tests can use memory without production credentials', () => {
  for (const NODE_ENV of ['development', 'test']) {
    const result = run(database, { NODE_ENV });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('production requires an explicit signing secret, even with DATABASE_URL', () => {
  const result = run(session, { DATABASE_URL: 'postgresql://unused.invalid/test' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SESSION_SECRET is required in production/);
});

test('configured production sessions remain valid in a fresh process', () => {
  const env = { SESSION_SECRET: 'isolated-test-session-secret-not-for-deployment' };
  const created = run(session, env);
  assert.equal(created.status, 0, created.stderr);
  const verified = run(`const { verifySessionValue } = await import('./src/lib/server/auth.ts');
    if (!verifySessionValue(${JSON.stringify(created.stdout.trim())}, 'production-config')) process.exit(1);`, env);
  assert.equal(verified.status, 0, verified.stderr);
});
