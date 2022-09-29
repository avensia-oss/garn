"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetaData = exports.writeMetaData = exports.writeMetaDataIfNotExists = exports.run = exports.garnExecutable = exports.onDone = exports.onSuccess = exports.onError = exports.onInit = exports.runTasks = exports.runTask = exports.spawnTask = exports.taskNameify = exports.internalProductionTask = exports.productionTask = exports.internalTask = exports.task = exports.taskGroup = exports.tasks = exports.projectPath = exports.typescript = exports.changelog = exports.github = exports.git = exports.yarn = exports.dotnet = exports.exec = exports.docker = exports.release = exports.version = exports.isInPath = exports.cliArgs = exports.prompt = exports.workspaces = exports.variables = exports.log = void 0;
const fs = require("fs");
const os = require("os");
const path = require("path");
const exec_1 = require("./exec");
const stringSimilarity = require("string-similarity");
const cliArgs = require("./cli-args");
exports.cliArgs = cliArgs;
const variables = require("./variables");
exports.variables = variables;
const log = require("./logging");
exports.log = log;
const prompt = require("./prompt");
exports.prompt = prompt;
const default_task_1 = require("./default-task");
const workspace = require("./workspace");
const chalk = require("chalk");
const exportedWorkspace = workspace;
exports.workspaces = exportedWorkspace;
var exec_2 = require("./exec");
Object.defineProperty(exports, "isInPath", { enumerable: true, get: function () { return exec_2.isInPath; } });
exports.version = require("./version");
exports.release = require("./release");
exports.docker = require("./docker");
exports.exec = require("./exec");
exports.dotnet = require("./dotnet");
exports.yarn = require("./yarn");
exports.git = require("./git");
exports.github = require("./github");
exports.changelog = require("./change-log");
exports.typescript = require("./typescript");
const flags = cliArgs.flags;
exports.projectPath = path.join(cliArgs.buildsystemPath, '..');
const plugins = {};
plugins['workspace'] = workspace;
function processExitOnError(e) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!cliArgs.testMode) {
            // Wait a tick to let logs flush
            yield new Promise(resolve => setTimeout(resolve));
            process.exit(1);
        }
        throw new Error();
    });
}
let currentTaskGroup = undefined;
const currentRunningTaskDescriptors = [];
let failedTaskDescriptor = undefined;
const taskResults = {};
const taskOnInitResults = {};
const globalOnDones = [];
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    for (const globalOnDone of globalOnDones) {
        const maybePromise = globalOnDone();
        if (isPromise(maybePromise)) {
            yield maybePromise;
        }
    }
    process.exit(0);
}));
exports.tasks = {};
function taskGroup(name, creator) {
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
exports.taskGroup = taskGroup;
function task(name, dependantTasksOrRunner, t) {
    return registerTask(name, dependantTasksOrRunner, t);
}
exports.task = task;
/** An internal task that can only be run as a dependant task of a top task */
function internalTask(name, dependantTasksOrRunner, taskRunner) {
    const internal = registerTask(name, dependantTasksOrRunner, taskRunner);
    internal.isInternalTask = true;
    return internal;
}
exports.internalTask = internalTask;
/** A production task forces the build into production mode when run */
function productionTask(name, dependantTasksOrRunner, taskRunner) {
    const external = registerTask(name, dependantTasksOrRunner, taskRunner);
    external.isProductionTask = true;
    return external;
}
exports.productionTask = productionTask;
/** An internal production task forces the build into production mode when run and that can only be run as a dependant task of a top task */
function internalProductionTask(name, dependantTasksOrRunner, taskRunner) {
    const internal = registerTask(name, dependantTasksOrRunner, taskRunner);
    internal.isProductionTask = true;
    internal.isInternalTask = true;
    return internal;
}
exports.internalProductionTask = internalProductionTask;
task('default', default_task_1.default);
function taskNameify(taskName) {
    return taskName
        .toLowerCase()
        .replace(/\./g, '-')
        .replace(/[^a-z0-9-]+/g, '');
}
exports.taskNameify = taskNameify;
function registerTask(name, dependantTasksOrRunner, task) {
    if (!/^[a-z0-9-]+$/.test(name)) {
        log.errorAndThrow('Invalid task name', name);
    }
    const onInits = [];
    const onSuccesses = [];
    const onErrors = [];
    const onDones = [];
    const runner = dependantTasksOrRunner && !Array.isArray(dependantTasksOrRunner) ? dependantTasksOrRunner : task || (() => null);
    const dependantTasks = dependantTasksOrRunner && Array.isArray(dependantTasksOrRunner) ? dependantTasksOrRunner : [];
    const taskGroup = currentTaskGroup;
    const fullName = (taskGroup === undefined ? '' : taskGroup + ':') + name;
    const taskDescriptor = {
        fullName,
        name,
        taskGroup,
        dependantTasks,
        isProductionTask: false,
        isInternalTask: false,
        _onInits: onInits,
        onInit(onInit) {
            onInits.push(onInit);
            return taskDescriptor;
        },
        onSuccess(onSuccess) {
            onSuccesses.push(onSuccess);
            return taskDescriptor;
        },
        onError(onError) {
            onErrors.push(onError);
            return taskDescriptor;
        },
        onDone(onDone) {
            onDones.push(onDone);
            return taskDescriptor;
        },
        run(dependantTaskResult) {
            return callTask(taskDescriptor, runner, dependantTaskResult, onSuccesses, onErrors, onDones);
        },
    };
    exports.tasks[taskDescriptor.fullName] = taskDescriptor;
    return taskDescriptor;
}
function callTask(taskDescriptor, runner, dependantTaskResult, onSuccesses, onErrors, onDones) {
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
                    log.verbose("Build time (task '" + taskDescriptor.fullName + "'):", timeDifference(startTime, stopTime));
                }
                return res;
            })
                .catch(err => {
                log.error('Task', taskDescriptor.fullName, 'failed with', err);
                return Promise.reject(err);
            });
        })
            .then(res => {
            currentRunningTaskDescriptors.pop();
            return callTaskListeners(res, taskDescriptor.taskGroup, onSuccesses.concat(onDones)).then(() => {
                return res;
            });
        }, err => {
            currentRunningTaskDescriptors.pop();
            return callTaskListeners(err, taskDescriptor.taskGroup, onErrors.concat(onDones)).then(() => {
                return Promise.reject(err);
            });
        })
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
function callTaskListeners(result, taskGroup, listeners) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield Promise.all(listeners.map((callbackOrTasks) => __awaiter(this, void 0, void 0, function* () {
            if (Array.isArray(callbackOrTasks)) {
                return yield runTasks(callbackOrTasks, taskGroup, result);
            }
            else {
                return callbackOrTasks(result);
            }
        })));
    });
}
function callTaskOnInitListeners(taskDescriptors) {
    return __awaiter(this, void 0, void 0, function* () {
        const taskNames = taskDescriptors.map(t => t.fullName);
        for (const taskDescriptor of taskDescriptors) {
            if (taskDescriptor._onInits.length) {
                if (!taskOnInitResults[taskDescriptor.fullName]) {
                    taskOnInitResults[taskDescriptor.fullName] = Promise.resolve().then(() => callTaskListeners(taskNames, taskDescriptor.taskGroup, taskDescriptor._onInits));
                    taskOnInitResults[taskDescriptor.fullName].catch(e => {
                        failedTaskDescriptor = taskDescriptor;
                    });
                }
                yield taskOnInitResults[taskDescriptor.fullName];
            }
        }
    });
}
function getTaskDescriptors(taskNames, taskGroup = null) {
    const taskDescriptors = [];
    for (const taskName of taskNames) {
        taskDescriptors.push(getTaskDescriptor(taskName, taskGroup));
    }
    return taskDescriptors;
}
function getTaskDescriptor(taskName, taskGroup = null) {
    let taskDescriptor = null;
    if (taskGroup) {
        taskDescriptor = exports.tasks[taskGroup + ':' + taskName];
    }
    if (!taskDescriptor) {
        taskDescriptor = exports.tasks[taskName];
    }
    if (!taskDescriptor) {
        const msg = 'Unknown task: ' + taskName;
        log.error(msg);
        throw new Error(msg);
    }
    return taskDescriptor;
}
function getTaskDescriptorsAndDepedants(taskNames, taskGroup = null, taskDescriptors = []) {
    taskDescriptors = taskDescriptors.concat(getTaskDescriptors(taskNames, taskGroup).filter(t => taskDescriptors.indexOf(t) === -1));
    for (const taskDescriptor of taskDescriptors) {
        const dependantTaskNames = taskDescriptor.dependantTasks.filter(dependantTaskName => {
            return taskDescriptors.indexOf(getTaskDescriptor(dependantTaskName, taskDescriptor.taskGroup)) === -1;
        });
        if (dependantTaskNames.length) {
            const dependantTaskDescriptors = getTaskDescriptorsAndDepedants(dependantTaskNames, taskDescriptor.taskGroup, taskDescriptors).filter(t => taskDescriptors.indexOf(t) === -1);
            taskDescriptors = taskDescriptors.concat(dependantTaskDescriptors);
        }
    }
    return taskDescriptors;
}
function spawnTask(taskName, taskGroup) {
    return __awaiter(this, void 0, void 0, function* () {
        if (taskGroup) {
            taskName = `${taskGroup}:${taskName}`;
        }
        const args = [taskName];
        for (const [name, value] of yield cliArgs.getChildArgs()) {
            if (args.indexOf(name) === -1) {
                args.push(name);
                if (value !== undefined) {
                    args.push(value);
                }
            }
        }
        log.verbose(`Spawning 'garn ${taskName}'`);
        return yield (0, exec_1.spawn)(path.join(exports.projectPath, garnExecutable()), args);
    });
}
exports.spawnTask = spawnTask;
function runTask(taskName, taskGroup, dependantTaskResult) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!taskGroup && currentRunningTaskDescriptors.length) {
            taskGroup = currentRunningTaskDescriptors.slice().pop().taskGroup;
        }
        return getTaskDescriptor(taskName, taskGroup).run(dependantTaskResult);
    });
}
exports.runTask = runTask;
function runTasks(taskNames, taskGroup, dependantTaskResult) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!taskGroup && currentRunningTaskDescriptors.length) {
            taskGroup = currentRunningTaskDescriptors.slice().pop().taskGroup;
        }
        // We need to call onInits here before calling `runTask` even though `runTask` will call the onInits.
        // This is because all onInits must run before any task is started.
        const allTaskDescriptors = getTaskDescriptorsAndDepedants(taskNames, taskGroup);
        yield callTaskOnInitListeners(allTaskDescriptors);
        const results = [];
        for (const taskName of taskNames) {
            results.push(yield runTask(taskName, taskGroup, dependantTaskResult));
        }
        return results;
    });
}
exports.runTasks = runTasks;
function timeDifference(start, stop) {
    const seconds = parseInt(((stop - start) / 1000).toFixed(0), 10);
    const minutes = Math.floor(seconds / 60);
    const minuteSeconds = seconds % 60;
    return minutes + 'm ' + minuteSeconds + 's';
}
const onInits = [];
/**
 * This runs before the build starts. It can be used to run build notifications or any setup
 * needed before a build runs. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
function onInit(cb) {
    onInits.push({
        listener: cb,
        taskGroup: currentTaskGroup,
    });
}
exports.onInit = onInit;
const onErrors = [];
/**
 * This runs after the build has failed. It can be used to run build notifications or any cleanup
 * needed after a build fails. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
function onError(cb) {
    onErrors.push({
        listener: cb,
        taskGroup: currentTaskGroup,
    });
}
exports.onError = onError;
const onSuccesses = [];
/**
 * This runs after the build has succeded. It can be used to run build notifications or any cleanup
 * needed after a build completes. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
function onSuccess(cb) {
    onSuccesses.push({
        listener: cb,
        taskGroup: currentTaskGroup,
    });
}
exports.onSuccess = onSuccess;
const onDones = [];
/**
 * This runs after the build has succeded or failed. It can be used to run build notifications or any cleanup
 * needed after a build completes. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
function onDone(cb) {
    onDones.push({
        listener: cb,
        taskGroup: currentTaskGroup,
    });
}
exports.onDone = onDone;
function callBuildProgressListeners(relevantTaskDescriptors, listeners, ...args) {
    return __awaiter(this, void 0, void 0, function* () {
        const taskGroups = relevantTaskDescriptors.map(t => t.taskGroup);
        for (const listener of listeners) {
            if (!listener.taskGroup || taskGroups.indexOf(listener.taskGroup) !== -1) {
                try {
                    yield listener.listener.apply(listener.listener, args);
                }
                catch (e) {
                    log.error('Error occured in build progress listener:', e);
                }
            }
        }
    });
}
function garnExecutable() {
    let garn = 'garn';
    if (os.platform() === 'win32') {
        garn += '.cmd';
    }
    return garn;
}
exports.garnExecutable = garnExecutable;
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        if ((yield cliArgs.flags.asap.get()) && !('child-garn' in cliArgs.argv)) {
            log.log(chalk.yellow(`You're using asap mode which means that things might break in unexpected ways as a sacrifice to get that sweet, sweet speed. If things doesn't seem to work, try the same command without --asap.`));
            log.log();
        }
        if (cliArgs.taskName in plugins) {
            yield plugins[cliArgs.taskName].runGarnPlugin();
            return;
        }
        const validatedTaskName = yield validateRequestedTask(cliArgs.taskName);
        if (validatedTaskName === undefined) {
            return;
        }
        let allTaskDescriptors;
        try {
            allTaskDescriptors = getTaskDescriptorsAndDepedants([validatedTaskName]);
        }
        catch (err) {
            yield log.error(validatedTaskName, 'failed');
            yield log.verbose('Err:', err);
            return yield processExitOnError(err);
        }
        const startTime = new Date().valueOf();
        if (allTaskDescriptors.find(t => t.isProductionTask)) {
            cliArgs.flags.mode.set('production');
        }
        const taskDescriptors = getTaskDescriptors([validatedTaskName]);
        yield callBuildProgressListeners(allTaskDescriptors, onInits, taskDescriptors);
        try {
            yield runTasks([validatedTaskName]);
            if (validatedTaskName !== 'default') {
                yield callBuildProgressListeners(taskDescriptors, onSuccesses, taskDescriptors);
                yield callBuildProgressListeners(taskDescriptors, onDones, taskDescriptors);
                const stopTime = new Date().valueOf();
                log.log("Build time (task '" + validatedTaskName + "'):", timeDifference(startTime, stopTime));
            }
        }
        catch (err) {
            if (!failedTaskDescriptor) {
                throw new Error('Internal error, task failed but failedTaskDescriptor was not set');
            }
            yield callBuildProgressListeners([failedTaskDescriptor], onErrors, failedTaskDescriptor, err);
            yield callBuildProgressListeners(allTaskDescriptors, onDones, taskDescriptors);
            yield log.error(failedTaskDescriptor.fullName, 'failed');
            yield log.error(err);
            return processExitOnError(err);
        }
    });
}
exports.run = run;
function validateRequestedTask(taskName) {
    return __awaiter(this, void 0, void 0, function* () {
        const taskNames = Object.keys(exports.tasks);
        const externalTaskNames = taskNames.filter(t => !exports.tasks[t].isInternalTask);
        if (taskNames.indexOf(taskName) === -1) {
            log.error("Unknown task '" + taskName + "'");
            const matches = stringSimilarity
                .findBestMatch(taskName, externalTaskNames)
                .ratings.filter(t => t.rating > 0.12)
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 5);
            if (matches.length && !(yield cliArgs.flags.noPrompt.get())) {
                log.log('\r\nDid you mean... ');
                log.log(matches.reduce((acc, curr, i) => {
                    return `${acc} ${i + 1}: ${curr.target} \r\n`;
                }, '') + '\r\n q: Quit');
                const response = yield prompt.question('');
                const numericChoice = parseInt(response);
                if (!Number.isNaN(numericChoice) && numericChoice <= matches.length) {
                    taskName = matches[numericChoice - 1].target;
                }
                else {
                    yield processExitOnError();
                }
            }
            else {
                yield processExitOnError();
            }
        }
        return taskName;
    });
}
const garnMetaFile = '.garn-meta.json';
function writeMetaDataIfNotExists(buildCachePath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(path.join(buildCachePath, garnMetaFile))) {
            return yield writeMetaData(buildCachePath);
        }
    });
}
exports.writeMetaDataIfNotExists = writeMetaDataIfNotExists;
function writeMetaData(buildCachePath) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const taskNames = Object.keys(exports.tasks).filter(name => name !== 'default' && !exports.tasks[name].isInternalTask);
        const cliFlags = {};
        for (const flag of Object.keys(flags)) {
            cliFlags['--' + flags[flag].name] = (_a = flags[flag].possibleValues) !== null && _a !== void 0 ? _a : [];
        }
        cliFlags['--compile-buildsystem'] = [];
        const pluginsMeta = {};
        for (const pluginName of Object.keys(plugins)) {
            const meta = yield plugins[pluginName].getGarnPluginMetaData();
            if (meta) {
                pluginsMeta[pluginName] = meta;
            }
        }
        const taskArgs = {};
        for (const taskName of taskNames) {
            const task = exports.tasks[taskName];
            if (task.subArgs) {
                taskArgs[taskName] = task.subArgs;
            }
            else if (task.subArgsJsonFile && fs.existsSync(task.subArgsJsonFile)) {
                try {
                    taskArgs[taskName] = JSON.parse(fs.readFileSync(task.subArgsJsonFile).toString());
                }
                catch (e) {
                    log.error('Error reading JSON file (' + task.subArgsJsonFile + ') for task sub arguments:', e);
                    taskArgs[taskName] = [];
                }
            }
            else {
                taskArgs[taskName] = [];
            }
        }
        const json = {
            tasks: taskArgs,
            flags: cliFlags,
            plugins: pluginsMeta,
        };
        fs.writeFile(path.join(buildCachePath, garnMetaFile), JSON.stringify(json, null, 2), () => null);
    });
}
exports.writeMetaData = writeMetaData;
function getMetaData(workspacePath, isRetry = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const garnPath = path.join(workspacePath, 'node_modules', '.bin', garnExecutable());
        const garnMetaFilePath = path.join(workspacePath, 'buildsystem', '.buildcache', garnMetaFile);
        if (fs.existsSync(garnMetaFilePath) && (isRetry || !('compile-buildsystem' in cliArgs.argv))) {
            try {
                return JSON.parse(fs.readFileSync(garnMetaFilePath).toString());
            }
            catch (e) {
                fs.unlinkSync(garnMetaFilePath);
                log.verbose(e);
            }
        }
        if (!isRetry) {
            const args = [];
            if ('compile-buildsystem' in cliArgs.argv) {
                args.push('--compile-buildsystem');
            }
            yield (0, exec_1.spawn)(garnPath, args, { stdio: 'pipe', cwd: workspacePath });
            return getMetaData(workspacePath, true);
        }
        else {
            throw new Error(`Garn at '${garnPath}' does not seem to produce a meta file when executed`);
        }
    });
}
exports.getMetaData = getMetaData;
function isPromise(x) {
    const p = x;
    return p && !!p.catch && !!p.then;
}
//# sourceMappingURL=index.js.map