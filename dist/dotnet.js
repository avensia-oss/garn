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
exports.solutionPath = exports.nugetPush = exports.pack = exports.publish = exports.build = exports.watchRun = exports.restore = exports.test = exports.clean = exports.run = exports.removePackage = exports.addPackage = exports.listProjectPackages = exports.removeProjectReferences = exports.addProjectReferences = exports.listProjectReferences = exports.removeSolutionProjects = exports.addSolutionProjects = exports.listProjects = void 0;
const path = require("path");
const index_1 = require("./index");
const exec_1 = require("./exec");
const cli_args_1 = require("./cli-args");
const version_1 = require("./version");
function listProjects(sln) {
    return __awaiter(this, void 0, void 0, function* () {
        const slnPath = sln !== null && sln !== void 0 ? sln : (yield solutionPath());
        if (!slnPath) {
            throw new Error('Unable to find a .sln file');
        }
        const result = yield (0, exec_1.spawn)('dotnet', ['sln', slnPath, 'list'], { stdio: 'pipe' });
        const lines = result.stdout
            .trim()
            .split('\n')
            .map(s => s.trim());
        const projects = [];
        let projectsStarted = false;
        for (const line of lines) {
            if (line.startsWith('-----')) {
                projectsStarted = true;
            }
            else if (projectsStarted) {
                projects.push(path.join(path.dirname(slnPath), line));
            }
        }
        return projects;
    });
}
exports.listProjects = listProjects;
function addSolutionProjects(slnPath, projectPaths) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield (0, exec_1.spawn)('dotnet', ['sln', slnPath, 'add', ...projectPaths], { stdio: 'pipe' });
        return result.stdout;
    });
}
exports.addSolutionProjects = addSolutionProjects;
function removeSolutionProjects(slnPath, projectPaths) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield (0, exec_1.spawn)('dotnet', ['sln', slnPath, 'remove', ...projectPaths], { stdio: 'pipe' });
        return result.stdout;
    });
}
exports.removeSolutionProjects = removeSolutionProjects;
function listProjectReferences(csprojPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield (0, exec_1.spawn)('dotnet', ['list', csprojPath, 'reference'], { stdio: 'pipe' });
        const lines = result.stdout
            .trim()
            .split('\n')
            .map(s => s.trim());
        const projectRefs = [];
        for (const line of lines) {
            projectRefs.push(line);
        }
        return projectRefs;
    });
}
exports.listProjectReferences = listProjectReferences;
function addProjectReferences(csprojPath, projectPaths) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield (0, exec_1.spawn)('dotnet', ['add', csprojPath, 'reference', ...projectPaths], { stdio: 'pipe' });
        return result.stdout;
    });
}
exports.addProjectReferences = addProjectReferences;
function removeProjectReferences(csprojPath, projectPaths) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield (0, exec_1.spawn)('dotnet', ['remove', csprojPath, 'reference', ...projectPaths], { stdio: 'pipe' });
        return result.stdout;
    });
}
exports.removeProjectReferences = removeProjectReferences;
function listProjectPackages(csprojPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield (0, exec_1.spawn)('dotnet', ['list', csprojPath, 'package'], { stdio: 'pipe' });
        const lines = result.stdout
            .trim()
            .split('\n')
            .map(s => s.trim());
        const projectRefs = [];
        for (const line of lines) {
            var values = line.split(' ');
            var packageDetails = { name: values[1], version: values[values.length] };
            if (line.startsWith('>'))
                projectRefs.push(packageDetails);
        }
        return projectRefs;
    });
}
exports.listProjectPackages = listProjectPackages;
function addPackage(csprojPath, projectPaths) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield (0, exec_1.spawn)('dotnet', ['add', csprojPath, 'package', ...projectPaths], { stdio: 'pipe' });
        return result.stdout;
    });
}
exports.addPackage = addPackage;
function removePackage(csprojPath, projectPaths) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield (0, exec_1.spawn)('dotnet', ['remove', csprojPath, 'package', ...projectPaths], { stdio: 'pipe' });
        return result.stdout;
    });
}
exports.removePackage = removePackage;
function run(project, appArgs, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = ['run'];
        args.push('--project', project);
        args.push('--launch-profile', options.launchProfile);
        return yield spawnDotnet(args, appArgs, options);
    });
}
exports.run = run;
function clean(entry, options) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield spawnDotnet(withEntry(entry, ['clean']), [], options);
    });
}
exports.clean = clean;
function test(entry, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = ['test'];
        if (entry) {
            args.push(entry);
        }
        if (options === null || options === void 0 ? void 0 : options.filter) {
            args.push('--filter', options.filter);
        }
        return yield spawnDotnet(args, [], options);
    });
}
exports.test = test;
function restore(entry, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = ['restore'];
        if (entry) {
            args.push(entry);
        }
        // Restore doesn't take the same base args as others
        return yield (0, exec_1.spawn)('dotnet', args, spawnOptions(options === null || options === void 0 ? void 0 : options.cwd));
    });
}
exports.restore = restore;
function watchRun(project, appArgs, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = ['watch', 'run'];
        args.push('--project', project);
        if (!options.cwd) {
            options.cwd = path.dirname(project);
        }
        args.push('--launch-profile', options.launchProfile);
        args.push('--no-restore');
        return yield spawnDotnet(args, appArgs, options);
    });
}
exports.watchRun = watchRun;
function build(entry, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = ['build'];
        if (entry) {
            args.push(entry);
        }
        return yield spawnDotnet(args, [], options);
    });
}
exports.build = build;
function publish(entry, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = ['publish', entry, '--output', options.outputPath];
        if (options.runtime) {
            args.push('--runtime', options.runtime);
        }
        return yield spawnDotnet(args, [], options);
    });
}
exports.publish = publish;
function pack(projectPath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = ['pack', projectPath];
        // Opt-out
        if (!(options === null || options === void 0 ? void 0 : options.excludeSymbols)) {
            args.push('--include-symbols');
        }
        if (!(options === null || options === void 0 ? void 0 : options.excludeSource)) {
            args.push('--include-source');
        }
        // Opt-in
        if (options === null || options === void 0 ? void 0 : options.force) {
            args.push('--force');
        }
        if (options === null || options === void 0 ? void 0 : options.runtime) {
            args.push('--runtime', options.runtime);
        }
        if (options === null || options === void 0 ? void 0 : options.output) {
            args.push('--output', options.output);
        }
        if (options === null || options === void 0 ? void 0 : options.serviceable) {
            args.push('--serviceable');
        }
        if (options === null || options === void 0 ? void 0 : options.versionSuffix) {
            args.push('--version-suffix', options.versionSuffix);
        }
        return yield spawnDotnet(args, [], options);
    });
}
exports.pack = pack;
function nugetPush(binPath, packageName, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = ['nuget', 'push', path.join(binPath, yield configuration(), packageName)];
        if (options === null || options === void 0 ? void 0 : options.apiKey) {
            args.push('--api-key', options.apiKey);
        }
        if (options === null || options === void 0 ? void 0 : options.source) {
            args.push('--source', options.source);
        }
        if (options === null || options === void 0 ? void 0 : options.skipDuplicate) {
            args.push('--skip-duplicate');
        }
        if (options === null || options === void 0 ? void 0 : options.noSymbols) {
            // temp workaround https://github.com/NuGet/Home/issues/4864
            if (options === null || options === void 0 ? void 0 : options.noSymbolsValue) {
                args.push('--no-symbols', options === null || options === void 0 ? void 0 : options.noSymbolsValue);
            }
            else {
                args.push('--no-symbols');
            }
        }
        if (options === null || options === void 0 ? void 0 : options.symbolSource) {
            args.push('--symbol-source', options.symbolSource);
        }
        if (options === null || options === void 0 ? void 0 : options.symbolApiKey) {
            args.push('--symbol-api-key', options.symbolApiKey);
        }
        return yield (0, exec_1.spawn)('dotnet', args);
    });
}
exports.nugetPush = nugetPush;
function solutionPath(targetPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const glob = yield Promise.resolve().then(() => require('glob'));
        const projPath = targetPath !== null && targetPath !== void 0 ? targetPath : index_1.projectPath;
        const result = glob.sync('*.sln', { cwd: projPath });
        if (!result[0]) {
            return undefined;
        }
        return path.join(projPath, result[0]);
    });
}
exports.solutionPath = solutionPath;
function withEntry(entry, args) {
    if (!entry) {
        return args;
    }
    return [entry, ...args];
}
function spawnDotnet(args, appArgs = [], options) {
    return __awaiter(this, void 0, void 0, function* () {
        const dotnetArgs = [...args];
        if (options === null || options === void 0 ? void 0 : options.noBuild) {
            dotnetArgs.push('--no-build');
        }
        if (options === null || options === void 0 ? void 0 : options.noRestore) {
            dotnetArgs.push('--no-restore');
        }
        dotnetArgs.push(...(yield baseArgs()));
        if (appArgs.length) {
            dotnetArgs.push('--', ...appArgs);
        }
        return yield (0, exec_1.spawn)('dotnet', dotnetArgs, spawnOptions(options === null || options === void 0 ? void 0 : options.cwd));
    });
}
function baseArgs() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = [
            ...(yield verbosityArg()),
            ...(yield configurationArg()),
            ...(yield versionArg()),
            ...(yield deterministicBuildArg()),
        ];
        return args;
    });
}
function spawnOptions(cwd) {
    if (cwd) {
        return { cwd };
    }
    return undefined;
}
function verbosityArg() {
    return __awaiter(this, void 0, void 0, function* () {
        const v = (() => __awaiter(this, void 0, void 0, function* () {
            switch (yield cli_args_1.flags.logLevel.get()) {
                case 'verbose':
                    return 'normal';
                case 'info':
                    return 'normal';
                case 'log':
                    return 'minimal';
                case 'warn':
                    return 'minimal';
                case 'error':
                    return 'quiet';
            }
        }))();
        return ['--verbosity', yield v];
    });
}
function configurationArg() {
    return __awaiter(this, void 0, void 0, function* () {
        return ['--configuration', yield configuration()];
    });
}
function deterministicBuildArg() {
    return __awaiter(this, void 0, void 0, function* () {
        if ((yield cli_args_1.flags.mode.get()) === 'production' && (yield cli_args_1.flags.buildServer.get())) {
            return ['-p:ContinuousIntegrationBuild=true'];
        }
        else {
            return [];
        }
    });
}
function configuration() {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield cli_args_1.flags.mode.get()) === 'production' ? 'Release' : 'Debug';
    });
}
function versionArg() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = [];
        if ((yield cli_args_1.flags.mode.get()) === 'production') {
            const version = yield (0, version_1.currentVersion)();
            const major = version.version.split('.')[0];
            let versionString = version.version;
            if (version.prerelease) {
                versionString += '-' + version.prerelease.tag + '.' + version.prerelease.number;
            }
            else {
                versionString += '.0'; // Important for the version to always have the format X.X.X.X
            }
            args.push(`-p:Version=${versionString}`);
            args.push(`-p:SourceRevisionId=${version.sha1}`);
        }
        return args;
    });
}
//# sourceMappingURL=dotnet.js.map