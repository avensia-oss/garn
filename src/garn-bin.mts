#!/usr/bin/env node

import { cliArgs, run, setProjectPath } from './index.mts';
import { getProjectRoot, getWorkspace, runTask } from './workspace.mts';
import path from 'path';
import { pathToFileURL } from 'url';
import chalk from 'chalk';
import fs from 'fs';
import childProcess from 'child_process';
import isInstalledGlobally from 'is-installed-globally';

const execExt = process.platform === 'win32' ? '.cmd' : '';

// Check for verbose flag
const verboseFlag = process.argv.includes('--verbose');
const verboseLog = verboseFlag ? console.log : () => {};

// Check for workspace= format in arguments
let workspacePackage = getWorkspace();

setProjectPath(workspacePackage?.workspacePath ?? process.cwd());

function cleanFileUrl(url: string): string {
  return url.replace(/^file:\/\/\/?/, '');
}

// Helper function to spawn and handle garn process
function spawnGarnProcess(command: string, args: string[], spawnOptions: childProcess.SpawnOptions, localGarn: string) {
  const childGarn = childProcess.spawn(command, args, spawnOptions);

  childGarn.on('exit', (exitCode: number) => {
    process.exit(exitCode);
  });

  childGarn.on('error', error => {
    console.error(chalk.red('❌ Error spawning local garn:'), error);
    console.error(chalk.red('Local garn path:'), localGarn);
    console.error(chalk.red('Current working directory:'), process.cwd());
    process.exit(1);
  });
}

const projectRoot = getProjectRoot();

if (isInstalledGlobally) {
  verboseLog(chalk.blue('🌐 Running garn in global mode'));

  if (!projectRoot) {
    console.error(chalk.red('❌ Error: Add a garn-workspaces.mts file to the root of your project to use garn'));
    process.exit(1);
  }

  // Try to find local garn in current directory first, then project root
  let localGarn = path.join(process.cwd(), 'node_modules', '.bin', 'garn' + execExt);
  let garnLocation = 'current directory';

  if (!fs.existsSync(localGarn)) {
    localGarn = path.join(projectRoot, 'node_modules', '.bin', 'garn' + execExt);
    garnLocation = 'project root';
  }

  verboseLog(chalk.blue('🔍 Looking for local garn at:'), localGarn, chalk.gray(`(${garnLocation})`));

  if (fs.existsSync(localGarn)) {
    verboseLog(chalk.green('✓ Local garn found at:', localGarn));
    verboseLog(chalk.green('✓ Spawning local garn process...'));

    const spawnOptions: childProcess.SpawnOptions = {
      cwd: process.cwd(),
      stdio: 'inherit',
    };

    if (process.platform === 'win32' && execExt === '.cmd') {
      const cmdPath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'cmd.exe');
      const args = ['/c', localGarn, '--no-experimental-warnings', ...process.argv.slice(2)];
      spawnGarnProcess(cmdPath, args, spawnOptions, localGarn);
    } else {
      const args = ['--no-experimental-warnings', ...process.argv.slice(2)];
      spawnGarnProcess(localGarn, args, spawnOptions, localGarn);
    }

    // Don't continue with task registration - let the child process handle everything
  } else {
    console.error(chalk.red('❌ Error: Garn is not installed in the current working directory'));
    console.error(
      chalk.yellow(
        '⚠️  Make sure you are running garn from a directory with a package.json file containing Garn (@avensia-oss/garn)',
      ),
    );
    verboseLog(chalk.gray('Expected garn location:'), localGarn);
    verboseLog(chalk.gray('Current working directory:'), process.cwd());
    verboseLog(chalk.gray('Project root:'), projectRoot);
    process.exit(1);
  }
} else {
  verboseLog(chalk.blue('🏠 Running garn in local mode'));

  let taskRegistryPath: string;
  let fileType: string;
  const workspacePath = path.join(workspacePackage?.workspacePath ?? process.cwd(), 'garn-workspace.mts');

  if (workspacePath && fs.existsSync(workspacePath)) {
    taskRegistryPath = workspacePath;
    fileType = 'garn-workspace.mts';
    verboseLog(chalk.blue('🔍 Using workspace file:'), workspacePath);
  } else if (projectRoot && fs.existsSync(path.join(projectRoot, 'garn-workspaces.mts'))) {
    taskRegistryPath = path.join(projectRoot, 'garn-workspaces.mts');
    fileType = 'garn-workspaces.mts';
    verboseLog(chalk.green('✓ Using garn-workspaces.mts from project root'));
  } else {
    console.error(chalk.red('❌ Error: Could not find garn-workspace.mts or garn-workspaces.mts'));
    console.error(
      chalk.yellow(
        '⚠️  Please ensure you are running garn from a directory that contains either garn-workspace.mts or garn-workspaces.mts file',
      ),
    );
    process.exit(0);
  }

  const taskRegistryUrl = pathToFileURL(taskRegistryPath).href;

  verboseLog(chalk.blue('📋 Loading garn tasks from:'), chalk.cyan(cleanFileUrl(taskRegistryUrl)));
  try {
    await import(taskRegistryUrl);
    verboseLog(chalk.green('✓ Configuration loaded successfully'));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Cannot find module')) {
        console.error(chalk.red(`❌ Error: Could not find ${fileType} at ${taskRegistryPath}`));
        console.error(
          chalk.yellow(`⚠️  Please ensure you are running garn from a directory that contains a ${fileType} file`),
        );
      } else {
        console.error(chalk.red(`❌ Error loading ${fileType}:`), error.message);
      }
    } else {
      console.error(chalk.red(`❌ Unknown error loading ${fileType}:`), error);
    }
    process.exit(0);
  }

  try {
    const firstArg = cliArgs.argv._[0];
    if (firstArg === 'workspace' && !workspacePackage) {
      await runTask(cliArgs.argv._[1]);
    } else if (firstArg && firstArg.startsWith('workspace=') && workspacePackage) {
      await run(cliArgs.argv._[1]);
    } else {
      await run(
        workspacePackage && workspacePackage.workspacePath !== process.cwd()
          ? (cliArgs.argv._[firstArg === 'workspace' ? 2 : 1] ?? 'default')
          : cliArgs.taskName,
      );
    }
  } catch (e) {
    console.error(chalk.red('❌ Error running garn:'), e);
    process.exit(1);
  }
}
