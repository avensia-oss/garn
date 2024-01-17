import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from './exec';
import * as stringSimilarity from 'string-similarity';

import * as cliArgs from './cli-args';
import * as variables from './variables';
import * as log from './logging';
import * as prompt from './prompt';
import defaultTask from './default-task';
import * as workspace from './workspace';
import chalk from 'chalk';
import { WorkspacePackage } from './workspace';

type Workpace = typeof workspace;
type ExternalWorkspace = Omit<Workpace, 'runGarnPlugin' | 'getGarnPluginMetaData'>;

const exportedWorkspace: ExternalWorkspace = workspace;

export { log };
export { variables };
export { exportedWorkspace as workspaces };
export { prompt };
export { cliArgs };
export { isInPath } from './exec';
export * as version from './version';
export * as release from './release';
export * as docker from './docker';
export * as exec from './exec';
export * as dotnet from './dotnet';
export * as yarn from './yarn';
export * as pnpm from './pnpm';
export * as git from './git';
export * as github from './github';
export * as changelog from './change-log';
export * as typescript from './typescript';
export * from './github-access';

const flags = cliArgs.flags;
export const projectPath = path.join(cliArgs.buildsystemPath, '..');

export type MetaData = {
  tasks: { [taskName: string]: string[] };
  plugins: { [name: string]: PluginMetaData };
  flags: { [name: string]: string[] };
};
export type PluginMetaData = { [name: string]: string[] | PluginMetaData };
export type Plugin = {
  runGarnPlugin: () => Promise<unknown>;
  getGarnPluginMetaData: () => Promise<PluginMetaData | undefined>;
};

const plugins: { [pluginName: string]: Plugin } = {};

plugins['workspace'] = workspace;

async function processExitOnError(e?: Error): Promise<never> {
  if (!cliArgs.testMode) {
    // Wait a tick to let logs flush
    await new Promise(resolve => setTimeout(resolve));
    process.exit(1);
  }
  throw new Error();
}

let currentTaskGroup: string | undefined = undefined;
const currentRunningTaskDescriptors: TaskDescriptor[] = [];
let failedTaskDescriptor: TaskDescriptor | undefined = undefined;

const taskResults: { [taskName: string]: Promise<any> } = {};
const taskOnInitResults: { [taskName: string]: Promise<any> } = {};

const globalOnDones: Array<() => unknown> = [];
process.on('SIGINT', async () => {
  for (const globalOnDone of globalOnDones) {
    const maybePromise = globalOnDone();
    if (isPromise(maybePromise)) {
      await maybePromise;
    }
  }
  process.exit(0);
});

type TaskRunner = (dependantTaskResult: any) => any | Promise<any>;
type DependantTasks = string[];
type DependantTasksOrRunner = DependantTasks | TaskRunner;

type OnTaskInit = ((taskNames: string[]) => any | Promise<any>) | string[];
type OnTaskSuccess = ((res: any) => any | Promise<void>) | string[];
type OnTaskError = ((err: any) => any | Promise<void>) | string[];
type OnTaskDone = ((res: any) => any | Promise<void>) | string[];

type TaskDescriptor = {
  _onInits: OnTaskInit[];
  isProductionTask: boolean;
  isInternalTask: boolean;
  fullName: string;
  name: string;
  taskGroup: string | undefined;
  dependantTasks: string[];
  /**
   * This will run before any other tasks or dependant tasks run.
   * It can be used to run prerequisite checks to fail the build early
   * if any the build task can't even be started.
   * It can also be used for notifications that task will run.
   * The difference between this and a dependant task is simply the order of when it runs.
   * All `onInit`s for the tasks and dependant tasks will run first, prior to any actual
   * tasks.
   */
  onInit: (onInit: OnTaskInit) => TaskDescriptor;
  /**
   * This will run immediately after this task has completed successfully.
   * Note that it will be called even if tasks after it might fail.
   */
  onSuccess: (onSuccess: OnTaskSuccess) => TaskDescriptor;
  /**
   * This will run immediately after this task has failed.
   */
  onError: (onError: OnTaskError) => TaskDescriptor;
  /**
   * This will run immediately after this task has failed or completed successfully.
   */
  onDone: (onDone: OnTaskDone) => TaskDescriptor;
  run: TaskRunner;
  subArgsJsonFile?: string;
  subArgs?: string[];
};

export const tasks: { [name: string]: TaskDescriptor } = {};

export function taskGroup(name: string, creator: () => void) {
  if (!/^[a-z0-9-]+$/.test(name)) {
    log.errorAndThrow('Invalid task group name', name);
  }
  if (currentTaskGroup) {
    throw new Error('Can not declare a task group within a task group');
  }
  currentTaskGroup = name;
  creator();
  currentTaskGroup = undefined;
}

export function task(name: string, dependantTasksOrRunner?: DependantTasksOrRunner, t?: TaskRunner) {
  return registerTask(name, dependantTasksOrRunner, t);
}

/** An internal task that can only be run as a dependant task of a top task */
export function internalTask(name: string, dependantTasksOrRunner?: DependantTasksOrRunner, taskRunner?: TaskRunner) {
  const internal = registerTask(name, dependantTasksOrRunner, taskRunner);
  internal.isInternalTask = true;
  return internal;
}

/** A production task forces the build into production mode when run */
export function productionTask(name: string, dependantTasksOrRunner?: DependantTasksOrRunner, taskRunner?: TaskRunner) {
  const external = registerTask(name, dependantTasksOrRunner, taskRunner);
  external.isProductionTask = true;
  return external;
}

/** An internal production task forces the build into production mode when run and that can only be run as a dependant task of a top task */
export function internalProductionTask(
  name: string,
  dependantTasksOrRunner?: DependantTasksOrRunner,
  taskRunner?: TaskRunner,
) {
  const internal = registerTask(name, dependantTasksOrRunner, taskRunner);
  internal.isProductionTask = true;
  internal.isInternalTask = true;
  return internal;
}

task('default', defaultTask);

export function taskNameify(taskName: string) {
  return taskName
    .toLowerCase()
    .replace(/\./g, '-')
    .replace(/[^a-z0-9-]+/g, '');
}

function registerTask(
  name: string,
  dependantTasksOrRunner?: DependantTasksOrRunner,
  task?: TaskRunner,
): TaskDescriptor {
  if (!/^[a-z0-9-]+$/.test(name)) {
    log.errorAndThrow('Invalid task name', name);
  }
  const onInits: OnTaskInit[] = [];
  const onSuccesses: OnTaskSuccess[] = [];
  const onErrors: OnTaskError[] = [];
  const onDones: OnTaskDone[] = [];

  const runner: TaskRunner =
    dependantTasksOrRunner && !Array.isArray(dependantTasksOrRunner) ? dependantTasksOrRunner : task || (() => null);
  const dependantTasks: DependantTasks =
    dependantTasksOrRunner && Array.isArray(dependantTasksOrRunner) ? dependantTasksOrRunner : [];
  const taskGroup = currentTaskGroup;
  const fullName = (taskGroup === undefined ? '' : taskGroup + ':') + name;

  const taskDescriptor: TaskDescriptor = {
    fullName,
    name,
    taskGroup,
    dependantTasks,
    isProductionTask: false,
    isInternalTask: false,
    _onInits: onInits,
    onInit(onInit: OnTaskInit) {
      onInits.push(onInit);
      return taskDescriptor;
    },
    onSuccess(onSuccess: OnTaskSuccess) {
      onSuccesses.push(onSuccess);
      return taskDescriptor;
    },
    onError(onError: OnTaskError) {
      onErrors.push(onError);
      return taskDescriptor;
    },
    onDone(onDone: OnTaskDone) {
      onDones.push(onDone);
      return taskDescriptor;
    },
    run(dependantTaskResult: any) {
      return callTask(taskDescriptor, runner, dependantTaskResult, onSuccesses, onErrors, onDones);
    },
  };
  tasks[taskDescriptor.fullName] = taskDescriptor;
  return taskDescriptor;
}

function callTask(
  taskDescriptor: TaskDescriptor,
  runner: TaskRunner,
  dependantTaskResult: any,
  onSuccesses: OnTaskSuccess[],
  onErrors: OnTaskError[],
  onDones: OnTaskDone[],
) {
  if (!!taskResults[taskDescriptor.fullName]) {
    return taskResults[taskDescriptor.fullName];
  }
  taskResults[taskDescriptor.fullName] = Promise.resolve()
    .then(() => {
      const allTaskDescriptors = getTaskDescriptorsAndDepedants([taskDescriptor.fullName], taskDescriptor.taskGroup);
      return callTaskOnInitListeners(allTaskDescriptors);
    })
    .then(() => {
      const dependantTaskDescriptors = getTaskDescriptors(taskDescriptor.dependantTasks, taskDescriptor.taskGroup);
      let waitFor = Promise.resolve();
      for (const dependantTaskDescriptor of dependantTaskDescriptors) {
        waitFor = waitFor.then(result => dependantTaskDescriptor.run(result));
      }
      return waitFor
        .then(() => {
          currentRunningTaskDescriptors.push(taskDescriptor);
          const startTime = new Date().valueOf();
          return Promise.resolve()
            .then(() => runner(dependantTaskResult))
            .then(res => {
              if (cliArgs.taskName !== taskDescriptor.fullName) {
                const stopTime = new Date().valueOf();
                log.verbose(
                  "Build time (task '" + taskDescriptor.fullName + "'):",
                  timeDifference(startTime, stopTime),
                );
              }
              return res;
            })
            .catch(err => {
              log.error('Task', taskDescriptor.fullName, 'failed with', err);
              return Promise.reject(err);
            });
        })
        .then(
          res => {
            currentRunningTaskDescriptors.pop();
            return callTaskListeners(res, taskDescriptor.taskGroup, onSuccesses.concat(onDones)).then(() => {
              return res;
            });
          },
          err => {
            currentRunningTaskDescriptors.pop();
            return callTaskListeners(err, taskDescriptor.taskGroup, onErrors.concat(onDones)).then(() => {
              return Promise.reject(err);
            });
          },
        )
        .catch(err => {
          failedTaskDescriptor = taskDescriptor;
          return Promise.reject(err);
        });
    });

  if (onDones.length) {
    globalOnDones.push(() => {
      callTaskListeners({}, taskDescriptor.taskGroup, onDones);
    });
  }

  return taskResults[taskDescriptor.fullName];
}

async function callTaskListeners(
  result: any,
  taskGroup: string | undefined,
  listeners: Array<OnTaskInit | OnTaskError | OnTaskDone | OnTaskSuccess>,
) {
  return await Promise.all(
    listeners.map(async callbackOrTasks => {
      if (Array.isArray(callbackOrTasks)) {
        return await runTasks(callbackOrTasks, taskGroup, result);
      } else {
        return (callbackOrTasks as any)(result);
      }
    }),
  );
}

async function callTaskOnInitListeners(taskDescriptors: TaskDescriptor[]) {
  const taskNames = taskDescriptors.map(t => t.fullName);
  for (const taskDescriptor of taskDescriptors) {
    if (taskDescriptor._onInits.length) {
      if (!taskOnInitResults[taskDescriptor.fullName]) {
        taskOnInitResults[taskDescriptor.fullName] = Promise.resolve().then(() =>
          callTaskListeners(taskNames, taskDescriptor.taskGroup, taskDescriptor._onInits),
        );
        taskOnInitResults[taskDescriptor.fullName].catch(e => {
          failedTaskDescriptor = taskDescriptor;
        });
      }
      await taskOnInitResults[taskDescriptor.fullName];
    }
  }
}

function getTaskDescriptors(taskNames: string[], taskGroup: string | null = null) {
  const taskDescriptors: TaskDescriptor[] = [];
  for (const taskName of taskNames) {
    taskDescriptors.push(getTaskDescriptor(taskName, taskGroup));
  }
  return taskDescriptors;
}

function getTaskDescriptor(taskName: string, taskGroup: string | null = null) {
  let taskDescriptor: TaskDescriptor | null = null;
  if (taskGroup) {
    taskDescriptor = tasks[taskGroup + ':' + taskName];
  }
  if (!taskDescriptor) {
    taskDescriptor = tasks[taskName];
  }
  if (!taskDescriptor) {
    const msg = 'Unknown task: ' + taskName;
    log.error(msg);
    throw new Error(msg);
  }
  return taskDescriptor;
}

function getTaskDescriptorsAndDepedants(
  taskNames: string[],
  taskGroup: string | null = null,
  taskDescriptors: TaskDescriptor[] = [],
) {
  taskDescriptors = taskDescriptors.concat(
    getTaskDescriptors(taskNames, taskGroup).filter(t => taskDescriptors.indexOf(t) === -1),
  );
  for (const taskDescriptor of taskDescriptors) {
    const dependantTaskNames = taskDescriptor.dependantTasks.filter(dependantTaskName => {
      return taskDescriptors.indexOf(getTaskDescriptor(dependantTaskName, taskDescriptor.taskGroup)) === -1;
    });
    if (dependantTaskNames.length) {
      const dependantTaskDescriptors = getTaskDescriptorsAndDepedants(
        dependantTaskNames,
        taskDescriptor.taskGroup,
        taskDescriptors,
      ).filter(t => taskDescriptors.indexOf(t) === -1);
      taskDescriptors = taskDescriptors.concat(dependantTaskDescriptors);
    }
  }
  return taskDescriptors;
}

export async function spawnTask(taskName: string, taskGroup?: string) {
  if (taskGroup) {
    taskName = `${taskGroup}:${taskName}`;
  }
  const args = [taskName];
  for (const [name, value] of await cliArgs.getChildArgs()) {
    if (args.indexOf(name) === -1) {
      args.push(name);
      if (value !== undefined) {
        args.push(value);
      }
    }
  }
  log.verbose(`Spawning 'garn ${taskName}'`);
  return await spawn(path.join(projectPath, garnExecutable()), args);
}

export async function runTask(taskName: string, taskGroup?: string, dependantTaskResult?: any) {
  if (!taskGroup && currentRunningTaskDescriptors.length) {
    taskGroup = currentRunningTaskDescriptors.slice().pop()!.taskGroup;
  }
  return getTaskDescriptor(taskName, taskGroup).run(dependantTaskResult);
}

export async function runTasks(taskNames: string[], taskGroup?: string, dependantTaskResult?: any) {
  if (!taskGroup && currentRunningTaskDescriptors.length) {
    taskGroup = currentRunningTaskDescriptors.slice().pop()!.taskGroup;
  }

  // We need to call onInits here before calling `runTask` even though `runTask` will call the onInits.
  // This is because all onInits must run before any task is started.
  const allTaskDescriptors = getTaskDescriptorsAndDepedants(taskNames, taskGroup);
  await callTaskOnInitListeners(allTaskDescriptors);

  const results: any[] = [];
  for (const taskName of taskNames) {
    results.push(await runTask(taskName, taskGroup, dependantTaskResult));
  }
  return results;
}

function timeDifference(start: number, stop: number) {
  const seconds = parseInt(((stop - start) / 1000).toFixed(0), 10);
  const minutes = Math.floor(seconds / 60);
  const minuteSeconds = seconds % 60;

  return minutes + 'm ' + minuteSeconds + 's';
}

type BuildProgressListener<T> = {
  taskGroup: string | undefined;
  listener: T;
};

type OnInit = (tasks: TaskDescriptor[]) => void | Promise<any>;
const onInits: Array<BuildProgressListener<OnInit>> = [];
/**
 * This runs before the build starts. It can be used to run build notifications or any setup
 * needed before a build runs. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
export function onInit(cb: OnInit) {
  onInits.push({
    listener: cb,
    taskGroup: currentTaskGroup,
  });
}

type OnError = (taskDescriptor: TaskDescriptor, err: any) => void | Promise<any>;
const onErrors: Array<BuildProgressListener<OnError>> = [];
/**
 * This runs after the build has failed. It can be used to run build notifications or any cleanup
 * needed after a build fails. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
export function onError(cb: OnError) {
  onErrors.push({
    listener: cb,
    taskGroup: currentTaskGroup,
  });
}

type OnSuccess = OnInit;
const onSuccesses: Array<BuildProgressListener<OnSuccess>> = [];
/**
 * This runs after the build has succeded. It can be used to run build notifications or any cleanup
 * needed after a build completes. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
export function onSuccess(cb: OnSuccess) {
  onSuccesses.push({
    listener: cb,
    taskGroup: currentTaskGroup,
  });
}

type OnDone = OnInit;
const onDones: Array<BuildProgressListener<OnDone>> = [];
/**
 * This runs after the build has succeded or failed. It can be used to run build notifications or any cleanup
 * needed after a build completes. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
export function onDone(cb: OnDone) {
  onDones.push({
    listener: cb,
    taskGroup: currentTaskGroup,
  });
}

async function callBuildProgressListeners(
  relevantTaskDescriptors: TaskDescriptor[],
  listeners: Array<BuildProgressListener<Function>>,
  ...args: any[]
) {
  const taskGroups = relevantTaskDescriptors.map(t => t.taskGroup);
  for (const listener of listeners) {
    if (!listener.taskGroup || taskGroups.indexOf(listener.taskGroup) !== -1) {
      try {
        await listener.listener.apply(listener.listener, args);
      } catch (e) {
        log.error('Error occured in build progress listener:', e);
      }
    }
  }
}

export function garnExecutable() {
  let garn = 'garn';
  if (os.platform() === 'win32') {
    garn += '.cmd';
  }
  return garn;
}

export async function run() {
  if ((await cliArgs.flags.asap.get()) && !('child-garn' in cliArgs.argv)) {
    log.log(
      chalk.yellow(
        `You're using asap mode which means that things might break in unexpected ways as a sacrifice to get that sweet, sweet speed. If things doesn't seem to work, try the same command without --asap.`,
      ),
    );
    log.log();
  }

  if (cliArgs.taskName in plugins) {
    await plugins[cliArgs.taskName].runGarnPlugin();
    return;
  }

  const validatedTaskName = await validateRequestedTask(cliArgs.taskName);
  if (validatedTaskName === undefined) {
    return;
  }

  let allTaskDescriptors;
  try {
    allTaskDescriptors = getTaskDescriptorsAndDepedants([validatedTaskName]);
  } catch (err) {
    await log.error(validatedTaskName, 'failed');
    await log.verbose('Err:', err);
    return await processExitOnError(err as Error);
  }

  const startTime = new Date().valueOf();
  if (allTaskDescriptors.find(t => t.isProductionTask)) {
    cliArgs.flags.mode.set('production');
  }

  const taskDescriptors = getTaskDescriptors([validatedTaskName]);
  await callBuildProgressListeners(allTaskDescriptors, onInits, taskDescriptors);
  try {
    await runTasks([validatedTaskName]);
    if (validatedTaskName !== 'default') {
      await callBuildProgressListeners(taskDescriptors, onSuccesses, taskDescriptors);
      await callBuildProgressListeners(taskDescriptors, onDones, taskDescriptors);
      const stopTime = new Date().valueOf();
      log.log("Build time (task '" + validatedTaskName + "'):", timeDifference(startTime, stopTime));
    }
  } catch (err) {
    if (!failedTaskDescriptor) {
      throw new Error('Internal error, task failed but failedTaskDescriptor was not set');
    }
    await callBuildProgressListeners([failedTaskDescriptor], onErrors, failedTaskDescriptor, err);
    await callBuildProgressListeners(allTaskDescriptors, onDones, taskDescriptors);
    await log.error(failedTaskDescriptor.fullName, 'failed');
    await log.error(err);
    return processExitOnError(err as Error);
  }
}

async function validateRequestedTask(taskName: string): Promise<string | undefined> {
  const taskNames = Object.keys(tasks);
  const externalTaskNames = taskNames.filter(t => !tasks[t].isInternalTask);

  if (taskNames.indexOf(taskName) === -1) {
    log.error("Unknown task '" + taskName + "'");
    const matches = stringSimilarity
      .findBestMatch(taskName, externalTaskNames)
      .ratings.filter(t => t.rating > 0.12)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);
    if (matches.length && !(await cliArgs.flags.noPrompt.get())) {
      log.log('\r\nDid you mean... ');
      log.log(
        matches.reduce((acc, curr, i) => {
          return `${acc} ${i + 1}: ${curr.target} \r\n`;
        }, '') + '\r\n q: Quit',
      );
      const response = await prompt.question('');
      const numericChoice = parseInt(response);
      if (!Number.isNaN(numericChoice) && numericChoice <= matches.length) {
        taskName = matches[numericChoice - 1].target;
      } else {
        await processExitOnError();
      }
    } else {
      await processExitOnError();
    }
  }

  return taskName;
}

const garnMetaFile = '.garn-meta.json';

export async function writeMetaDataIfNotExists(buildCachePath: string) {
  if (!fs.existsSync(path.join(buildCachePath, garnMetaFile))) {
    return await writeMetaData(buildCachePath);
  }
}

export async function writeMetaData(buildCachePath: string) {
  const taskNames = Object.keys(tasks).filter(name => name !== 'default' && !tasks[name].isInternalTask);
  const cliFlags: { [name: string]: string[] } = {};
  for (const flag of Object.keys(flags)) {
    cliFlags['--' + flags[flag].name] = flags[flag].possibleValues ?? [];
  }
  cliFlags['--compile-buildsystem'] = [];
  const pluginsMeta: { [name: string]: PluginMetaData } = {};
  for (const pluginName of Object.keys(plugins)) {
    const meta = await plugins[pluginName].getGarnPluginMetaData();
    if (meta) {
      pluginsMeta[pluginName] = meta;
    }
  }
  const taskArgs: { [taskName: string]: string[] } = {};
  for (const taskName of taskNames) {
    const task = tasks[taskName];
    if (task.subArgs) {
      taskArgs[taskName] = task.subArgs!;
    } else if (task.subArgsJsonFile && fs.existsSync(task.subArgsJsonFile)) {
      try {
        taskArgs[taskName] = JSON.parse(fs.readFileSync(task.subArgsJsonFile).toString());
      } catch (e) {
        log.error('Error reading JSON file (' + task.subArgsJsonFile + ') for task sub arguments:', e);
        taskArgs[taskName] = [];
      }
    } else {
      taskArgs[taskName] = [];
    }
  }
  const json: MetaData = {
    tasks: taskArgs,
    flags: cliFlags,
    plugins: pluginsMeta,
  };
  fs.writeFile(path.join(buildCachePath, garnMetaFile), JSON.stringify(json, null, 2), () => null);
}

export async function getMetaData(pkg: WorkspacePackage, isRetry = false): Promise<MetaData> {
  const garnPath = pkg.garnPath;
  const garnMetaFilePath = path.join(pkg.workspacePath, 'buildsystem', '.buildcache', garnMetaFile);

  if (fs.existsSync(garnMetaFilePath) && (isRetry || !('compile-buildsystem' in cliArgs.argv))) {
    try {
      return JSON.parse(fs.readFileSync(garnMetaFilePath).toString()) as MetaData;
    } catch (e) {
      fs.unlinkSync(garnMetaFilePath);
      log.verbose(e);
    }
  }
  if (!isRetry) {
    const args: string[] = [];
    if ('compile-buildsystem' in cliArgs.argv) {
      args.push('--compile-buildsystem');
    }

    await spawn(garnPath, args, { stdio: 'pipe', cwd: pkg.workspacePath });
    return getMetaData(pkg, true);
  } else {
    throw new Error(`Garn at '${garnPath}' does not seem to produce a meta file when executed`);
  }
}

function isPromise(x: unknown): x is Promise<unknown> {
  const p = x as Promise<unknown>;
  return p && !!p.catch && !!p.then;
}
