import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { garnExecutable } from './index.mts';
import * as git from './git.mts';
import * as cliArgs from './cli-args.mts';
import type { Version } from './version.mts';
import * as log from './logging.mts';
import type { ParallelProgram } from './run-in-parallel.mts';
import { runInParallel } from './run-in-parallel.mts';
import { fromTag, isVersionTag } from './version.mts';

export type WorkspacePackage = {
  name: string;
  garnPath: string;
  workspacePath: string;
};

const taggedWorkspacesFlag = cliArgs.registerFlag<boolean>('tagged-workspaces', 'boolean', false);

export function getWorkspace() {
  const workspaceArg = cliArgs.argv._.find(arg => arg.startsWith('workspace='));
  let workspaceName: string;

  if (workspaceArg) {
    workspaceName = workspaceArg.split('=')[1];
  } else if (cliArgs.argv._[0] === 'workspace' && cliArgs.argv._[1]) {
    workspaceName = cliArgs.argv._[1];
  } else {
    workspaceName = cliArgs.argv._[0];
  }

  const workspaces = list();

  let workspacePackage = workspaces?.find(p => p.name === workspaceName);

  if (!workspacePackage) {
    workspacePackage = workspaces?.find(p => p.name === workspaceName);
  }

  if (!workspacePackage) {
    const currentDir = process.cwd();
    workspacePackage = workspaces?.find(p => p.workspacePath === currentDir);
  }

  setCurrentWorkspace(workspacePackage);
  return workspacePackage;
}

export async function runTask(taskName: string, packageName?: string) {
  const packages = list();

  if (!packages) {
    log.log('No workspace packages found');
    return;
  }

  const programs: ParallelProgram[] = [];
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
      // For now, assume the task exists and run it
      // TODO: Add proper task metadata checking when available
      if (!onlyInTagged || versions.find(v => v.packageName === pkg.name)) {
        packageNames.push(pkg.name);
        programs.push({
          program: pkg.garnPath,
          args: ['workspace=' + pkg.name, taskName],
          prefix: '[' + pkg.name + '] ',
          cwd: pkg.workspacePath,
        });
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

  const maxParallelism = (await cliArgs.flags.parallel.get()) ? Infinity : 1;
  return await runInParallel(programs, true, maxParallelism);
}

export function setCurrentWorkspace(workspace: WorkspacePackage) {
  currentWorkspace = workspace;
}

let currentWorkspace: WorkspacePackage | null | undefined = undefined;
export function current() {
  return currentWorkspace;
}

async function exit(): Promise<never> {
  if (!cliArgs.testMode) {
    // Wait a tick to let logs flush
    await new Promise(resolve => setTimeout(resolve));
    process.exit(1);
  }
  throw new Error();
}

// Function to find the project root by looking for garn-workspaces.mts
export function findProjectRootWithGarnWorkspaces(): string | null {
  let currentPath = process.cwd();

  let count = 0;
  while (true) {
    const garnWorkspacesPath = path.join(currentPath, 'garn-workspaces.mts');

    if (fs.existsSync(garnWorkspacesPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
    count++;
    if (count > 5) {
      break;
    }
  }

  return null;
}

let projectRoot: string | undefined = undefined;
export function getProjectRoot() {
  if (projectRoot) {
    return projectRoot;
  }
  return (projectRoot = findProjectRootWithGarnWorkspaces());
}

export function list() {
  // Always look for workspace packages from the project root, not the current working directory
  const projectRoot = getProjectRoot();
  if (!projectRoot) {
    return undefined;
  }

  const packageJsonPath = path.join(projectRoot, 'package.json');
  const workspaces = expandWorkspaces(packageJsonPath);

  if (workspaces) {
    return workspaces;
  }

  // If no workspaces found via package.json, check for garn-workspaces.mts at project root
  const garnWorkspacesPath = path.join(projectRoot, 'garn-workspaces.mts');
  if (fs.existsSync(garnWorkspacesPath)) {
    return [
      {
        name: path.basename(projectRoot),
        workspacePath: projectRoot,
        garnPath: path.join(projectRoot, 'node_modules', '.bin', garnExecutable()),
      },
    ];
  }

  return undefined;
}

function expandWorkspaces(packageJsonPath) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());
  const projectRoot = path.dirname(packageJsonPath);

  const workspacePatterns = packageJson.garnWorkspaces
      ?? packageJson.workspaces?.packages
      ?? packageJson.workspaces;

  if (Array.isArray(workspacePatterns)) {
      const workspaces = [];
      for (const workspace of workspacePatterns) {
          // Find each workspace that has a garn-workspace.mts file
          // Always use '/' even on windows, because node-glob wants it that way
          const expanded = glob.sync([workspace, 'garn-workspace.mts'].join('/'), {
              cwd: projectRoot,
          });
          workspaces.push(...expanded.map(e => {
              // Goes from packages/cloudflare-webapp/garn-workspace.mts to packages/cloudflare-webapp
              const relativeWorkspacePath = path.dirname(e);
              return {
                  name: path.basename(relativeWorkspacePath),
                  workspacePath: path.join(projectRoot, relativeWorkspacePath),
                  garnPath: path.join(projectRoot, 'node_modules', '.bin', garnExecutable()),
              };
          }));
      }
      return workspaces;
  }
  // Check if there's a garn-workspaces.mts file at the project root
  const garnWorkspacesPath = path.join(projectRoot, 'garn-workspaces.mts');
  if (fs.existsSync(garnWorkspacesPath)) {
      // Return a special workspace entry for the root project with garn-workspaces.mts
      return [
          {
              name: path.basename(projectRoot),
              workspacePath: projectRoot,
              garnPath: path.join(projectRoot, 'node_modules', '.bin', garnExecutable()),
          },
      ];
  }
  return undefined;
}

