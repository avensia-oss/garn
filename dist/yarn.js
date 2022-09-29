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
exports.runBin = exports.yarnInfo = exports.publishPackage = exports.runScript = void 0;
const os = require("os");
const path = require("path");
const index_1 = require("./index");
const exec = require("./exec");
const version_1 = require("./version");
function runScript(script, args = []) {
    return __awaiter(this, void 0, void 0, function* () {
        return runYarn(['run', script, ...args]);
    });
}
exports.runScript = runScript;
function publishPackage(packageFolderName) {
    return __awaiter(this, void 0, void 0, function* () {
        const packagePath = packageFolderName ? path.join(index_1.projectPath, 'src', packageFolderName) : index_1.projectPath;
        const [versionString, isPrerelease] = yield versionArg();
        return runYarn([
            'publish',
            packagePath,
            '--new-version',
            versionString,
            '--no-git-tag-version',
            '--tag',
            isPrerelease ? 'rc' : 'latest',
        ]);
    });
}
exports.publishPackage = publishPackage;
function versionArg() {
    return __awaiter(this, void 0, void 0, function* () {
        const version = yield (0, version_1.currentVersion)();
        let versionString = version.version;
        if (version.prerelease) {
            versionString += '-' + version.prerelease.tag + '.' + version.prerelease.number;
        }
        return [versionString, !!version.prerelease];
    });
}
function yarnInfo() {
    return runYarn(['config', 'list']);
}
exports.yarnInfo = yarnInfo;
function runBin(bin, args = []) {
    return __awaiter(this, void 0, void 0, function* () {
        const yarnBinOutput = (yield runYarn(['bin', bin], { stdio: 'pipe' })).stdout.trim();
        const executablePath = yarnBinOutput.split(os.EOL).pop();
        const executable = os.platform() === 'win32' ? executablePath + '.cmd' : executablePath;
        return yield exec.spawn(executable, args, {
            cwd: index_1.projectPath,
        });
    });
}
exports.runBin = runBin;
function runYarn(args = [], options) {
    return __awaiter(this, void 0, void 0, function* () {
        const executable = os.platform() === 'win32' ? 'yarn.cmd' : 'yarn';
        return yield exec.spawn(path.join(index_1.projectPath, executable), args, Object.assign({ cwd: index_1.projectPath }, (options !== null && options !== void 0 ? options : {})));
    });
}
//# sourceMappingURL=yarn.js.map