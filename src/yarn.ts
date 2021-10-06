import * as os from 'os';
import * as childProcess from 'child_process';
import * as path from 'path';
import { projectPath } from './index';
import * as exec from './exec';
import { currentVersion } from './version';
import * as workspace from './workspace';

export async function runScript(script: string, args: string[] = []) {
  return runYarn(['run', script, ...args]);
}

export async function publishPackage() {
  const version = await versionArg();
  return runYarn(['publish', projectPath, '--new-version', version, '--no-git-tag-version']);
}

async function versionArg() {
  const version = await currentVersion();
  let versionString = version.version;
  if (version.prerelease) {
    versionString += '-' + version.prerelease.tag + '.' + version.prerelease.number;
  }
  return versionString;
}

export function yarnInfo() {
  return runYarn(['config', 'list']);
}

export async function runBin(bin: string, args: string[] = []) {
  const executablePath = (await runYarn(['bin', bin], { stdio: 'pipe' })).stdout.trim();
  const executable = os.platform() === 'win32' ? executablePath + '.cmd' : executablePath;
  return await exec.spawn(executable, args, {
    cwd: projectPath,
  });
}

async function runYarn(args: string[] = [], options?: childProcess.SpawnOptions) {
  const executable = os.platform() === 'win32' ? 'yarn.cmd' : 'yarn';
  return await exec.spawn(path.join(projectPath, executable), args, {
    cwd: projectPath,
    ...(options ?? {}),
  });
}
