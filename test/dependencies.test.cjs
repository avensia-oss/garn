const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../package.json');

test('TypeScript is a >=5 peer, not a bundled runtime dependency', () => {
  assert.equal(manifest.peerDependencies.typescript, '>=5');
  assert.equal(manifest.dependencies.typescript, undefined);
  assert.equal(manifest.devDependencies.typescript, '^5.0.0');
});

test('dependency ranges use patch-zero baselines', () => {
  for (const [name, range] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
    assert.match(range, /^[~^]\d+\.\d+\.0$/, `${name}: ${range}`);
  }
  // A caret would restrict this pre-1.0 package to <0.0.1.
  assert.equal(manifest.devDependencies['@types/through'], '~0.0.0');
});

test('all runtime dependencies are used and all third-party imports are declared', () => {
  const imports = new Set();
  for (const file of fs.readdirSync(path.resolve('src'))) {
    const source = fs.readFileSync(path.resolve('src', file), 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\(|import\.meta\.resolve\()['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (specifier.startsWith('.') || specifier.startsWith('node:') || require('node:module').isBuiltin(specifier)) {
        continue;
      }
      imports.add(specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]);
    }
  }
  for (const dependency of Object.keys(manifest.dependencies)) {
    assert.ok(imports.has(dependency), `Unused runtime dependency: ${dependency}`);
  }
  for (const dependency of imports) {
    assert.ok(
      dependency in manifest.dependencies || dependency in manifest.peerDependencies,
      `Undeclared runtime dependency: ${dependency}`,
    );
  }
});

test('the five-day package age gate remains configured', () => {
  assert.match(fs.readFileSync('.yarnrc.yml', 'utf8'), /^npmMinimalAgeGate: 7200$/m);
});
