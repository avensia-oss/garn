import * as workspace from 'fs';
import * as path from 'path';
import * as glob from 'glob';

import { garnExecutable, getMetaData } from './';
import * as git from './git';
import * as cliArgs from './cli-args';
import { Version } from './version';
import * as log from './logging';
import runInParallell from './run-in-parallell';
import { spawn } from './exec';
import { fromTag, isVersionTag } from './version';

export type WorkspacePackage = {
  name: string;
  garnPath: string;
};

const taggedWorkspacesFlag = cliArgs.registerFlag<boolean>('tagged-workspaces', 'boolean', false);

export async function runTask(taskName: string, packageName?: string) {
  const packages = list();

  if (!packages) {
    log.log('No workspace packages found');
    return;
  }

  const programs: { program: string; args: string[]; prefix: string }[] = [];
  let packagesToRunTaskIn = packages;
  if (packageName) {
    packagesToRunTaskIn = packagesToRunTaskIn.filter(p => p.name === packageName);
  }

  const cliVersionString = await cliArgs.flags.version.get();

  if (cliVersionString !== undefined) {
    if (!isVersionTag(cliVersionString)) {
      await log.error(
        `The --version flag '${cliVersionString}' is not in a valid format, it should either be in the format 'v1.2.3' or 'my-package@1.2.3'`,
      );
      return exit();
    }
    const cliVersion = await fromTag(cliVersionString);
    if (cliVersion.packageName) {
      const cliPackage = packages.find(p => p.name === cliVersion.packageName);
      if (cliPackage) {
        packagesToRunTaskIn = [cliPackage];
      } else {
        await log.error(
          `No package with the name '${
            cliVersion.packageName
          }' could be found in this workspace. Existing packages are: ${packages.map(p => p.name).join(', ')}`,
        );
        return exit();
      }
    }
  }

  const onlyInTagged = await taggedWorkspacesFlag.get();
  const tags = await git.getTags();
  const versionTags = tags.filter(isVersionTag);
  const versions: Version[] = [];
  for (const versionTag of versionTags) {
    versions.push(await fromTag(versionTag));
  }

  if (onlyInTagged && !versions.length) {
    throw new Error('No workspace packages found that has a version tag on the current commit');
  }

  const packageNames = [];
  for (const pkg of packages) {
    if (packagesToRunTaskIn.find(p => p.name === pkg.name)) {
      const packageMeta = await getMetaData(pkg.garnPath);
      if (taskName in packageMeta.tasks) {
        if (!onlyInTagged || versions.find(v => v.packageName === pkg.name)) {
          packageNames.push(pkg.name);
          programs.push({
            program: pkg.garnPath,
            args: [taskName],
            prefix: '[' + pkg.name + '] ',
          });
        }
      }
    }
  }

  if (!packageNames.length) {
    if (onlyInTagged) {
      throw new Error(
        `The currently tagged workspace package(s) (${versions
          .map(v => v.packageName)
          .join(', ')}) does not have a task called '${taskName}'`,
      );
    } else {
      throw new Error(`No workspace packages has a task called '${taskName}'`);
    }
  }

  log.log("Running task '" + taskName + "' in packages " + packageNames.join(', '));
  log.log('');

  return await runInParallell(programs);
}

export async function runGarnPlugin() {
  const packages = list();

  if (!packages) {
    log.log('No workspace packages found');
    return;
  }

  if (cliArgs.argv._.length === 1) {
    log.log('');
    log.log('The following packages are included in this workspace:');
    log.log('------------------------------------------------------');
    for (const pkg of packages) {
      log.log(' ' + pkg.name);
    }
    log.log('');
    log.log('You can run a task in all packages by calling:');
    log.log('$ garn workspace the-name-of-my-task');
    log.log('');
    log.log('You can run a task in a single package by calling:');
    log.log('$ garn workspace the-name-of-my-package the-name-of-my-task');
  } else if (cliArgs.argv._.length >= 2 && packages.find(p => p.name === cliArgs.argv._[1])) {
    const packageName = cliArgs.argv._[1];
    const taskName = cliArgs.argv._[2] || 'default';

    const pkg = packages.find(p => p.name === packageName);
    if (!pkg) {
      await log.error(
        `No package with the name '${packageName}' could be found in this workspace. Existing packages are: ${packages
          .map(p => p.name)
          .join(', ')}`,
      );
      return exit();
    }
    try {
      const args = [taskName];
      for (const arg of cliArgs.argv._.slice(3)) {
        args.push(arg);
      }
      for (const key of Object.keys(cliArgs.argv)) {
        const flag = cliArgs.flags[key];
        if (flag) {
          const value = await flag.get();
          if (value !== flag.defaultValue) {
            args.push(`--${flag.name}`, value);
          }
        } else if (key !== '--' && key !== '_' && key !== cliArgs.buildsystemPathArgName) {
          args.push(`--${key}`, cliArgs.argv[key]);
        }
      }
      if (cliArgs.argv['--']?.length) {
        args.push('--', ...cliArgs.argv['--']);
      }
      await spawn(pkg.garnPath, args);
    } catch (e) {
      return exit();
    }
  } else if (cliArgs.argv._.length === 2) {
    // Because cliArgs.argv._[0] === 'workspace'
    const taskName = cliArgs.argv._[1];

    try {
      await runTask(taskName);
    } catch (e) {
      await log.error(e);
      return exit();
    }
  }
}

let currentWorkspace: WorkspacePackage | null | undefined = undefined;
export function current() {
  if (currentWorkspace !== undefined) {
    return currentWorkspace === null ? undefined : currentWorkspace;
  }
  let currentPath = path.join(cliArgs.buildsystemPath, '..');
  while (true) {
    const packageJsonPath = path.join(currentPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      const workspaces = expandWorkspaces(packageJsonPath);
      if (workspaces) {
        currentWorkspace = workspaces.find(
          w => cliArgs.buildsystemPath.replace(/\\/g, '/').indexOf(`/${w.name}/`) !== -1,
        );
        return currentWorkspace;
      }
    }
    const parentPath = path.join(currentPath, '..');
    if (parentPath === currentPath) {
      return undefined;
    } else {
      currentPath = parentPath;
    }
  }
}

export async function getGarnPluginMetaData() {
  const packages = list();
  if (!packages) {
    return undefined;
  }

  const tasksWithCount: { [name: string]: number } = {};

  const metaData: { [pkg: string]: { [taskName: string]: string[] } } = {};
  for (const pkg of packages) {
    const packageMeta = await getMetaData(pkg.garnPath);
    metaData[pkg.name] = packageMeta.tasks;

    for (const taskName of Object.keys(packageMeta.tasks)) {
      if (!(taskName in tasksWithCount)) {
        tasksWithCount[taskName] = 0;
      }
      tasksWithCount[taskName]++;
    }
  }
  for (const taskName of Object.keys(tasksWithCount)) {
    if (tasksWithCount[taskName] > 1) {
      metaData[taskName] = {};
    }
  }

  return metaData;
}

async function exit(): Promise<never> {
  if (!cliArgs.testMode) {
    // Wait a tick to let logs flush
    await new Promise(resolve => setTimeout(resolve));
    process.exit(1);
  }
  throw new Error();
}

function existsSync(file: string) {
  try {
    return workspace.existsSync(file);
  } catch (e) {
    return false;
  }
}

export function list() {
  const packageJsonPath = path.join(cliArgs.buildsystemPath, '..', 'package.json');
  return expandWorkspaces(packageJsonPath);
}

function expandWorkspaces(packageJsonPath: string) {
  const packageJson = JSON.parse(workspace.readFileSync(packageJsonPath).toString());
  if (packageJson.workspaces) {
    const workspaces: WorkspacePackage[] = [];
    for (const workspace of packageJson.workspaces) {
      const expanded = glob.sync(path.join(workspace, garnExecutable()), { cwd: path.dirname(packageJsonPath) });
      workspaces.push(
        ...expanded.map(e => ({
          name: path.basename(path.dirname(e)),
          garnPath: path.join(path.dirname(packageJsonPath), e),
        })),
      );
    }
    return workspaces;
  }
  return undefined;
}
