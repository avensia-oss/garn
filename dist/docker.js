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
exports.remove = exports.createVolume = exports.exec = exports.logout = exports.login = exports.push = exports.tag = exports.build = exports.run = void 0;
const path = require("path");
const fs = require("fs");
const exec_1 = require("./exec");
const log = require("./logging");
const version = require("./version");
function run(args) {
    return __awaiter(this, void 0, void 0, function* () {
        yield verifyDockerInPath();
        return (0, exec_1.spawn)('docker', ['run', ...args]);
    });
}
exports.run = run;
function build(tag, dockerFilePath, context) {
    return __awaiter(this, void 0, void 0, function* () {
        yield verifyDockerInPath();
        if (!fs.lstatSync(dockerFilePath).isFile()) {
            throw new Error('Path to Dockerfile is not a file');
        }
        if (path.basename(dockerFilePath) !== 'Dockerfile') {
            throw new Error('Path to Dockerfile is not a Dockerfile');
        }
        if (!context) {
            context = path.dirname(dockerFilePath);
        }
        const currentVersion = yield version.currentVersion();
        return (0, exec_1.spawn)('docker', [
            'build',
            '--no-cache',
            '--build-arg',
            `Version=${currentVersion.version}`,
            '--build-arg',
            `CommitId=${currentVersion.sha1}`,
            '--tag',
            tag,
            '-f',
            dockerFilePath,
            '.',
        ], { cwd: context });
    });
}
exports.build = build;
function tag(image, tag) {
    return __awaiter(this, void 0, void 0, function* () {
        yield verifyDockerInPath();
        return (0, exec_1.spawn)('docker', ['tag', image, tag]);
    });
}
exports.tag = tag;
function push(registry, image) {
    return __awaiter(this, void 0, void 0, function* () {
        yield verifyDockerInPath();
        return (0, exec_1.spawn)('docker', ['push', `${registry}/${image}`]);
    });
}
exports.push = push;
function login(registry, username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        yield verifyDockerInPath();
        return (0, exec_1.spawn)('docker', ['login', '--username', username, '--password', password, registry]);
    });
}
exports.login = login;
function logout(registry) {
    return __awaiter(this, void 0, void 0, function* () {
        yield verifyDockerInPath();
        return (0, exec_1.spawn)('docker', ['logout', registry]);
    });
}
exports.logout = logout;
function exec(container, command, args) {
    return __awaiter(this, void 0, void 0, function* () {
        yield verifyDockerInPath();
        return (0, exec_1.spawn)('docker', ['exec', '-it', container, command, ...args]);
    });
}
exports.exec = exec;
function createVolume(name) {
    return __awaiter(this, void 0, void 0, function* () {
        yield verifyDockerInPath();
        return (0, exec_1.spawn)('docker', ['volume', 'create', name]);
    });
}
exports.createVolume = createVolume;
function remove(container) {
    return __awaiter(this, void 0, void 0, function* () {
        yield verifyDockerInPath();
        try {
            yield (0, exec_1.spawn)('docker', ['stop', container], { stdio: 'pipe' });
            yield (0, exec_1.spawn)('docker', ['rm', container], { stdio: 'pipe' });
        }
        catch (e) {
            log.verbose(`Error deleting container '${container}'`);
            log.verbose(String(e));
        }
    });
}
exports.remove = remove;
function verifyDockerInPath() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield (0, exec_1.isInPath)('docker'))) {
            throw new Error(`'docker' is not in your PATH, you either need to install docker (Docker Desktop on Windows) or add it to your PATH`);
        }
    });
}
//# sourceMappingURL=docker.js.map