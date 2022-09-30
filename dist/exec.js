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
exports.executablePath = exports.isInPath = exports.spawn = exports.spawnSync = void 0;
const childProcess = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const log = require("./logging");
const variables = require("./variables");
const prompt = require("./prompt");
function spawnSync(command, args, options) {
    if (command.indexOf('/') === -1 && command.indexOf('\\') === -1) {
        if (!isInPath(command)) {
            throw new Error(`The executable '${command}' could not be found in your PATH. You should add it to the PATH or reinstall the program.`);
        }
    }
    const processResult = childProcess.spawnSync(command, args, options);
    return {
        stdout: processResult.stdout.toString('utf8'),
        stderr: processResult.stderr.toString('utf8'),
    };
}
exports.spawnSync = spawnSync;
function spawn(command, args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (command.indexOf('/') === -1 && command.indexOf('\\') === -1) {
            if (!isInPath(command)) {
                throw new Error(`The executable '${command}' could not be found in your PATH. You should add it to the PATH or reinstall the program.`);
            }
        }
        return new Promise((resolve, reject) => {
            options = options || {};
            if (!options.stdio) {
                options.stdio = [process.stdin, process.stdout, process.stderr];
            }
            let programName = command;
            if (path.isAbsolute(command)) {
                programName = path.basename(programName);
            }
            log.verbose(`Spawning '${command}' with args '${args.join(' ')}'`);
            const spawnedProcess = childProcess.spawn(command, args, options);
            const outChunks = [];
            const outListener = (chunk) => outChunks.push(chunk);
            if (spawnedProcess.stdout) {
                spawnedProcess.stdout.on('data', outListener);
            }
            else {
                outChunks.push(Buffer.from(`Are you trying to capture the output of a spawned process? Then you should pass {stdio: 'pipe'} as options to spawn()`));
            }
            const errChunks = [];
            const errListener = (chunk) => errChunks.push(chunk);
            if (spawnedProcess.stderr) {
                spawnedProcess.stderr.on('data', errListener);
            }
            spawnedProcess.on('error', err => {
                var _a, _b;
                log.error(err);
                (_a = spawnedProcess.stderr) === null || _a === void 0 ? void 0 : _a.removeListener('data', errListener);
                (_b = spawnedProcess.stdout) === null || _b === void 0 ? void 0 : _b.removeListener('data', outListener);
                reject(`${programName} ${args.join(' ')} failed`);
            });
            spawnedProcess.on('exit', (code) => {
                var _a, _b;
                (_a = spawnedProcess.stderr) === null || _a === void 0 ? void 0 : _a.removeListener('data', errListener);
                (_b = spawnedProcess.stdout) === null || _b === void 0 ? void 0 : _b.removeListener('data', outListener);
                if (code && code !== 3221225786) {
                    const stderr = Buffer.concat(errChunks).toString('utf8');
                    reject(`${programName} ${args.join(' ')} failed with code ${code}. ${stderr ? 'Output:' + stderr : ''}`);
                }
                else {
                    resolve({
                        stdout: Buffer.concat(outChunks).toString('utf8'),
                        stderr: Buffer.concat(errChunks).toString('utf8'),
                    });
                }
            });
        });
    });
}
exports.spawn = spawn;
const commandsFoundInPath = [];
function isInPath(command) {
    if (commandsFoundInPath.indexOf(command) !== -1) {
        return true;
    }
    try {
        if (os.platform() === 'win32') {
            const res = childProcess.spawnSync('where', [command]);
            if (res.status !== 0) {
                return false;
            }
        }
        else {
            const res = childProcess.spawnSync('whereis', [command]);
            if (res.error && res.error.code === 'ENOENT') {
                throw new Error(`Error trying to locate binary for "${command}". Make sure that 'whereis' is installed on your system.`);
            }
            if (res.status !== 0) {
                return false;
            }
        }
        commandsFoundInPath.push(command);
        return true;
    }
    catch (e) {
        log.verbose(`Error when trying to find ${command} in the PATH`, e);
        return false;
    }
}
exports.isInPath = isInPath;
function executablePath(executableName, variableName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (process.env[variableName]) {
            return process.env[variableName];
        }
        let executablePath = '';
        if (!isInPath(executableName)) {
            while (true) {
                executablePath = yield prompt.question(`Enter the path to your '${executableName}' executable`);
                if (!fs.existsSync(executablePath)) {
                    log.log(`No file called '${executablePath}' exists, please try again`);
                }
                else {
                    break;
                }
            }
            variables.saveEnvVariable(variableName, executablePath);
        }
        else {
            variables.saveEnvVariable(variableName, executableName);
            executablePath = executableName;
        }
        return executablePath;
    });
}
exports.executablePath = executablePath;
//# sourceMappingURL=exec.js.map