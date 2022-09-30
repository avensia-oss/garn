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
exports.list = exports.getGarnPluginMetaData = exports.current = exports.runGarnPlugin = exports.runTask = void 0;
const workspace = require("fs");
const path = require("path");
const glob = require("glob");
const fs = require("fs");
const _1 = require("./");
const git = require("./git");
const cliArgs = require("./cli-args");
const log = require("./logging");
const run_in_parallel_1 = require("./run-in-parallel");
const exec_1 = require("./exec");
const version_1 = require("./version");
const taggedWorkspacesFlag = cliArgs.registerFlag('tagged-workspaces', 'boolean', false);
function runTask(taskName, packageName) {
    return __awaiter(this, void 0, void 0, function* () {
        const packages = list();
        if (!packages) {
            log.log('No workspace packages found');
            return;
        }
        const programs = [];
        let packagesToRunTaskIn = packages;
        if (packageName) {
            packagesToRunTaskIn = packagesToRunTaskIn.filter(p => p.name === packageName);
        }
        const cliVersionString = yield cliArgs.flags.version.get();
        if (cliVersionString !== undefined) {
            if (!(0, version_1.isVersionTag)(cliVersionString)) {
                yield log.error(`The --version flag '${cliVersionString}' is not in a valid format, it should either be in the format 'v1.2.3' or 'my-package@1.2.3'`);
                return exit();
            }
            const cliVersion = yield (0, version_1.fromTag)(cliVersionString);
            if (cliVersion.packageName) {
                const cliPackage = packages.find(p => p.name === cliVersion.packageName);
                if (cliPackage) {
                    packagesToRunTaskIn = [cliPackage];
                }
                else {
                    yield log.error(`No package with the name '${cliVersion.packageName}' could be found in this workspace. Existing packages are: ${packages.map(p => p.name).join(', ')}`);
                    return exit();
                }
            }
        }
        const onlyInTagged = yield taggedWorkspacesFlag.get();
        const tags = yield git.getTags();
        const versionTags = tags.filter(version_1.isVersionTag);
        const versions = [];
        for (const versionTag of versionTags) {
            versions.push(yield (0, version_1.fromTag)(versionTag));
        }
        if (onlyInTagged && !versions.length) {
            throw new Error('No workspace packages found that has a version tag on the current commit');
        }
        const packageNames = [];
        for (const pkg of packages) {
            if (packagesToRunTaskIn.find(p => p.name === pkg.name)) {
                const packageMeta = yield (0, _1.getMetaData)(pkg.workspacePath);
                if (taskName in packageMeta.tasks) {
                    if (!onlyInTagged || versions.find(v => v.packageName === pkg.name)) {
                        packageNames.push(pkg.name);
                        programs.push({
                            program: pkg.garnPath,
                            args: [taskName],
                            prefix: '[' + pkg.name + '] ',
                            cwd: pkg.workspacePath,
                        });
                    }
                }
            }
        }
        if (!packageNames.length) {
            if (onlyInTagged) {
                throw new Error(`The currently tagged workspace package(s) (${versions
                    .map(v => v.packageName)
                    .join(', ')}) does not have a task called '${taskName}'`);
            }
            else {
                throw new Error(`No workspace packages has a task called '${taskName}'`);
            }
        }
        log.log("Running task '" + taskName + "' in packages " + packageNames.join(', '));
        log.log('');
        const maxParallelism = (yield cliArgs.flags.parallel.get()) ? Infinity : 1;
        return yield (0, run_in_parallel_1.runInParallel)(programs, true, maxParallelism);
    });
}
exports.runTask = runTask;
function runGarnPlugin() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
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
        }
        else if (cliArgs.argv._.length >= 2 && packages.find(p => p.name === cliArgs.argv._[1])) {
            const packageName = cliArgs.argv._[1];
            const taskName = cliArgs.argv._[2] || 'default';
            const pkg = packages.find(p => p.name === packageName);
            if (!pkg) {
                yield log.error(`No package with the name '${packageName}' could be found in this workspace. Existing packages are: ${packages
                    .map(p => p.name)
                    .join(', ')}`);
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
                        const value = yield flag.get();
                        if (value !== flag.defaultValue) {
                            args.push(`--${flag.name}`, value);
                        }
                    }
                    else if (key !== '--' && key !== '_' && key !== cliArgs.buildsystemPathArgName) {
                        args.push(`--${key}`, cliArgs.argv[key]);
                    }
                }
                if ((_a = cliArgs.argv['--']) === null || _a === void 0 ? void 0 : _a.length) {
                    args.push('--', ...cliArgs.argv['--']);
                }
                yield (0, exec_1.spawn)(pkg.garnPath, args, { cwd: pkg.workspacePath });
            }
            catch (e) {
                return exit();
            }
        }
        else if (cliArgs.argv._.length === 2) {
            // Because cliArgs.argv._[0] === 'workspace'
            const taskName = cliArgs.argv._[1];
            try {
                yield runTask(taskName);
            }
            catch (e) {
                yield log.error(e);
                return exit();
            }
        }
    });
}
exports.runGarnPlugin = runGarnPlugin;
let currentWorkspace = undefined;
function current() {
    if (currentWorkspace !== undefined) {
        return currentWorkspace === null ? undefined : currentWorkspace;
    }
    let currentPath = path.join(cliArgs.buildsystemPath, '..');
    while (true) {
        const packageJsonPath = path.join(currentPath, 'package.json');
        if (existsSync(packageJsonPath)) {
            const workspaces = expandWorkspaces(packageJsonPath);
            if (workspaces) {
                currentWorkspace = workspaces.find(w => cliArgs.buildsystemPath.replace(/\\/g, '/').indexOf(`/${w.name}/`) !== -1);
                return currentWorkspace;
            }
        }
        const parentPath = path.join(currentPath, '..');
        if (parentPath === currentPath) {
            return undefined;
        }
        else {
            currentPath = parentPath;
        }
    }
}
exports.current = current;
function getGarnPluginMetaData() {
    return __awaiter(this, void 0, void 0, function* () {
        const packages = list();
        if (!packages) {
            return undefined;
        }
        const tasksWithCount = {};
        const metaData = {};
        for (const pkg of packages) {
            const packageMeta = yield (0, _1.getMetaData)(pkg.workspacePath);
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
    });
}
exports.getGarnPluginMetaData = getGarnPluginMetaData;
function exit() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!cliArgs.testMode) {
            // Wait a tick to let logs flush
            yield new Promise(resolve => setTimeout(resolve));
            process.exit(1);
        }
        throw new Error();
    });
}
function existsSync(file) {
    try {
        return workspace.existsSync(file);
    }
    catch (e) {
        return false;
    }
}
function list() {
    const packageJsonPath = path.join(cliArgs.buildsystemPath, '..', 'package.json');
    return expandWorkspaces(packageJsonPath);
}
exports.list = list;
function expandWorkspaces(packageJsonPath) {
    var _a, _b;
    const packageJson = JSON.parse(workspace.readFileSync(packageJsonPath).toString());
    if (Array.isArray(packageJson.workspaces) || Array.isArray((_a = packageJson.workspaces) === null || _a === void 0 ? void 0 : _a.packages)) {
        const workspaces = [];
        const relativeBuildsystemPath = path.relative(path.dirname(packageJsonPath), cliArgs.buildsystemPath);
        for (const workspace of (_b = packageJson.workspaces.packages) !== null && _b !== void 0 ? _b : packageJson.workspaces) {
            // Find each workspace that have a dependency on garn.
            const expanded = glob.sync(path.join(workspace, 'node_modules', '.bin', (0, _1.garnExecutable)()), {
                cwd: path.dirname(packageJsonPath),
            });
            workspaces.push(...expanded
                .map(e => {
                // Goes from excite-packages/packages/core/node_modules/.bin/garn to excite-packages/packages/core
                const relativeWorkspacePath = path.join(e, '..', '..', '..'); // Ugly af
                return {
                    name: path.basename(relativeWorkspacePath),
                    workspacePath: path.join(path.dirname(packageJsonPath), relativeWorkspacePath),
                    garnPath: path.join(path.dirname(packageJsonPath), e),
                };
            })
                .filter(entry => fs.existsSync(path.join(entry.workspacePath, relativeBuildsystemPath))));
        }
        return workspaces;
    }
    return undefined;
}
//# sourceMappingURL=workspace.js.map