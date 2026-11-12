#!/usr/bin/env node
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as childProcess from 'node:child_process';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import minimist from 'minimist';
import isInstalledGlobally from 'is-installed-globally';

const execExt = os.platform() === 'win32' ? '.cmd' : '';

function restartGarn(rootPath: string) {
  const garnPath = path.join(rootPath, 'node_modules', '.bin', 'garn' + execExt);
  const child = childProcess.spawn(garnPath, process.argv.slice(2), {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  });
  child.on('error', fail);
  child.on('exit', code => process.exit(code ?? 1));
}

function fail(error: unknown) {
  console.error(error);
  process.exitCode = 1;
}

async function main() {
  if (process.argv.includes('--internal-version')) {
    const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(packageJson.version);
    return;
  }

  if (isInstalledGlobally) {
    if (!fs.existsSync(path.join(process.cwd(), 'node_modules', '.bin', 'garn' + execExt))) {
      throw new Error('Garn is not installed in the current working directory.');
    }
    restartGarn(process.cwd());
    return;
  }

  const buildsystemPathArgName = 'buildsystem-path';
  const argv = minimist(process.argv.slice(2));
  const buildsystemPath = path.resolve(argv[buildsystemPathArgName] || path.join(process.cwd(), 'buildsystem'));
  if (!fs.existsSync(buildsystemPath)) {
    throw new Error(`No buildsystem folder exists at: ${buildsystemPath}`);
  }
  // Set this before importing Garn, whose CLI module reads process.argv on initialization.
  if (!(buildsystemPathArgName in argv)) {
    process.argv.splice(2, 0, '--' + buildsystemPathArgName, buildsystemPath);
  }

  const buildCachePath = path.join(buildsystemPath, '.buildcache');
  const basePath = path.dirname(buildsystemPath);
  let rootPath = basePath;
  if (
    !fs.existsSync(path.join(basePath, 'packages', 'garn.cmd')) &&
    path.basename(path.dirname(basePath)) === 'packages'
  ) {
    rootPath = path.resolve(basePath, '..', '..');
  }

  if (await restoreNpmPackagesIfNeeded(rootPath, buildCachePath)) {
    restartGarn(rootPath);
    return;
  }

  const entryPath = path.join(buildsystemPath, 'index.mts');
  if (!fs.existsSync(entryPath)) {
    throw new Error(`No buildsystem entry point exists at: ${entryPath}`);
  }
  await import(pathToFileURL(entryPath).href);
  const garn = await import('./index.mjs');
  fs.mkdirSync(buildCachePath, { recursive: true });
  await garn.writeMetaData(buildCachePath);
  await garn.run();
}

async function restoreNpmPackagesIfNeeded(rootPath: string, buildCachePath: string) {
  const yarnLockPath = path.join(rootPath, 'yarn.lock');
  const packageLockPath = path.join(rootPath, 'package-lock.json');
  const usesYarn = fs.existsSync(yarnLockPath);
  const lockPath = usesYarn ? yarnLockPath : packageLockPath;
  if (!fs.existsSync(lockPath)) {
    return false;
  }

  const checksumPath = usesYarn
    ? path.join(rootPath, 'tools', '.yarn.checksum')
    : path.join(buildCachePath, '.package-lock.checksum');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(lockPath)).digest('hex');
  if (
    fs.existsSync(path.join(rootPath, 'node_modules')) &&
    fs.existsSync(checksumPath) &&
    fs.readFileSync(checksumPath, 'utf8') === hash
  ) {
    return false;
  }

  const command = (usesYarn ? 'yarn' : 'npm') + execExt;
  const localCommand = path.join(rootPath, command);
  await new Promise<void>((resolve, reject) => {
    const child = childProcess.spawn(
      fs.existsSync(localCommand) ? localCommand : command,
      usesYarn ? [] : ['install'],
      {
        cwd: rootPath,
        stdio: 'inherit',
        shell: true,
      },
    );
    child.on('error', reject);
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`))));
  });
  fs.mkdirSync(path.dirname(checksumPath), { recursive: true });
  fs.writeFileSync(checksumPath, crypto.createHash('sha256').update(fs.readFileSync(lockPath)).digest('hex'));
  return true;
}

main().catch(fail);
