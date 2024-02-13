import * as os from 'os';
import * as childProcess from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { projectPath } from './index';
import * as exec from './exec';
import { currentVersion } from './version';
import { runNode } from './node';

export async function runScript(script: string, args: string[] = []) {
  return runYarn(['run', script, ...args]);
}

export async function publishPackage(packageFolderName?: string) {
  const packagePath = packageFolderName ? path.join(projectPath, 'src', packageFolderName) : projectPath;
  const [versionString, isPrerelease] = await versionArg();
  return runYarn([
    'publish',
    packagePath,
    '--new-version',
    versionString,
    '--no-git-tag-version',
    '--tag',
    isPrerelease ? 'rc' : 'latest',
  ]);
}

async function versionArg(): Promise<[string, boolean]> {
  const version = await currentVersion();
  let versionString = version.version;

  if (version.prerelease) {
    versionString += '-' + version.prerelease.tag + '.' + version.prerelease.number;
  }

  return [versionString, !!version.prerelease];
}

export function yarnInfo() {
  return runYarn(['config', 'list']);
}

export async function runBin(bin: string, args: string[] = []) {
  const yarnBinOutput = (await runYarn(['bin', bin], { stdio: 'pipe' })).stdout.trim();
  /**
   * Output can get bloated with echos from scripts and such. So we have no safe way of
   * determine where in the list our actual output is.
   *
   * This will filter out all that noise and pick the real result from our command above
   */
  const executablePath = yarnBinOutput
    // Windows can also return \n only in some environments
    .split(/\n|\r\n/)
    .filter(s => {
      return fs.existsSync(s);
    })
    .pop()!;

  if (executablePath === undefined || executablePath.length === 0) {
    throw new Error(`Could not find the executable path for '${bin}'`);
  }

  /**
   * Since introduction of Yarn PnP we can't rely on node_modules being present.
   * yarn bin now returns the path of the js to be executed instead of the
   * node_modules/.bin
   */
  if (executablePath.indexOf(path.join('node_modules', '.bin')) === -1) {
    if (executablePath.endsWith('.js')) {
      return await runNode([executablePath, ...args]);
    }
  }

  // Yarn v1
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
