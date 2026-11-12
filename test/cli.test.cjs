const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const cli = path.resolve('dist/garn-bin.mjs');
const garnUrl = pathToFileURL(path.resolve('dist/index.mjs')).href;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'garn-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'buildsystem'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }));
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

test('runs .mts directly with imports and top-level await, without tsconfig or compilation', t => {
  const root = fixture(t);
  const buildsystem = path.join(root, 'buildsystem');
  fs.writeFileSync(path.join(buildsystem, 'message.mts'), 'export const message: string = "native-typescript";');
  fs.writeFileSync(
    path.join(buildsystem, 'index.mts'),
    `
    import { task } from ${JSON.stringify(garnUrl)};
    import { message } from './message.mts';
    await Promise.resolve();
    task('hello', () => console.log(message));
  `,
  );
  let result = run(root, 'hello', '--no-prompt');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /native-typescript/);
  const cache = path.join(buildsystem, '.buildcache');
  assert.deepEqual(fs.readdirSync(cache), ['.garn-meta.json']);
  const metadata = JSON.parse(fs.readFileSync(path.join(cache, '.garn-meta.json')));
  assert.ok('hello' in metadata.tasks);
  assert.ok(!('--compile-buildsystem' in metadata.flags));
  fs.writeFileSync(path.join(buildsystem, 'message.mts'), 'export const message: string = "updated-source";');
  result = run(root, 'hello', '--asap', '--no-prompt');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /updated-source/);
});

test('supports an explicit buildsystem path containing spaces', t => {
  const root = fixture(t);
  const buildsystem = path.join(root, 'custom tasks');
  fs.renameSync(path.join(root, 'buildsystem'), buildsystem);
  fs.writeFileSync(
    path.join(buildsystem, 'index.mts'),
    `import { task } from ${JSON.stringify(garnUrl)}; task('hello', () => console.log('custom-path'));`,
  );
  const result = run(root, 'hello', '--buildsystem-path', buildsystem, '--no-prompt');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /custom-path/);
});

test('reports a missing .mts entry point', t => {
  const root = fixture(t);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No buildsystem entry point.*index\.mts/);
});

test('propagates buildsystem import errors', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'buildsystem', 'index.mts'), 'throw new Error("broken-buildsystem");');
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /broken-buildsystem/);
});

test('prints internal version without a buildsystem', t => {
  const root = fixture(t);
  const result = run(root, '--internal-version');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), require('../package.json').version);
});

test('typecheck helper uses the TypeScript CLI and returns diagnostics', t => {
  const root = fixture(t);
  fs.writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { noEmit: true, types: [] },
      include: ['check.mts'],
    }),
  );
  fs.writeFileSync(path.join(root, 'check.mts'), 'const value: string = 123;');
  fs.writeFileSync(
    path.join(root, 'buildsystem', 'index.mts'),
    `
    import { task, typescript } from ${JSON.stringify(garnUrl)};
    task('check', async () => {
      const result = await typescript.typecheck(${JSON.stringify(path.join(root, 'tsconfig.json'))});
      if (!result.hasErrors || !result.errors.some(error => error.includes('TS2322'))) {
        throw new Error(JSON.stringify(result));
      }
      console.log('diagnostics-returned');
    });
  `,
  );
  const result = run(root, 'check', '--no-prompt');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /diagnostics-returned/);
});
