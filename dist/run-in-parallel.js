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
exports.runInParallel = void 0;
const path = require("path");
const child_process_1 = require("child_process");
const through = require("through");
const stream = require("stream");
const log = require("./logging");
const cliArgs = require("./cli-args");
function runInParallel(programs, isGarn = true, maxParallelism = Infinity) {
    return __awaiter(this, void 0, void 0, function* () {
        const batches = [];
        let i = 0;
        let currentBatch = [];
        for (const program of programs) {
            currentBatch.push(program);
            i++;
            if (i == maxParallelism) {
                batches.push(currentBatch);
                currentBatch = [];
                i = 0;
            }
        }
        let results = [];
        for (const batch of batches) {
            results.push(yield executePrograms(batch, isGarn));
        }
        return maxParallelism === Infinity ? results[0] : results;
    });
}
exports.runInParallel = runInParallel;
function executePrograms(programs, isGarn = true) {
    let anyStreamIsOutputting = false;
    let unpauseStreams = [];
    return Promise.all(programs.map(program => {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            let thisStreamIsOutputting = false;
            const stdio = [process.stdin, 'pipe', 'pipe'];
            const args = program.args;
            if (isGarn) {
                for (const [name, value] of yield cliArgs.getChildArgs()) {
                    if (args.indexOf(name) === -1) {
                        args.push(name);
                        if (value !== undefined) {
                            args.push(value);
                        }
                    }
                }
            }
            log.verbose(`Spawning '${program.program}${args.length === 0 ? '' : ' '}${args.join(' ')}'`);
            const command = (0, child_process_1.spawn)(program.program, args, { stdio });
            const outThrough = through(function (data) {
                this.queue((program.prefix || '') + data);
            }, function () {
                this.queue(null);
            });
            const errThrough = through(function (data) {
                this.queue((program.prefix || '') + data);
            }, function () {
                this.queue(null);
            });
            const outStream = new stream.Writable();
            outStream._write = (chunk, enc, next) => {
                outThrough.write(chunk);
                next();
            };
            const errStream = new stream.Writable();
            errStream._write = (chunk, enc, next) => {
                errThrough.write(chunk);
                next();
            };
            if (anyStreamIsOutputting) {
                outThrough.pause();
                errThrough.pause();
                unpauseStreams.push(() => {
                    outThrough.resume();
                    errThrough.resume();
                    thisStreamIsOutputting = true;
                });
            }
            else {
                anyStreamIsOutputting = true;
                thisStreamIsOutputting = true;
            }
            command.stdout.pipe(outStream);
            command.stderr.pipe(errStream);
            outThrough.pipe(process.stdout);
            errThrough.pipe(process.stderr);
            command.on('exit', (code) => {
                if (code) {
                    let programName = program.program;
                    if (path.isAbsolute(programName)) {
                        programName = path.basename(programName);
                    }
                    reject(`${programName} ${program.args.join(' ')} failed`);
                }
                else {
                    resolve();
                }
                if (thisStreamIsOutputting) {
                    const unpauseNext = unpauseStreams.shift();
                    if (unpauseNext) {
                        unpauseNext();
                    }
                }
            });
        }));
    })).then(() => {
        unpauseStreams.forEach(unpause => unpause());
        unpauseStreams = [];
    }, e => {
        unpauseStreams.forEach(unpause => unpause());
        unpauseStreams = [];
        return Promise.reject(e);
    });
}
//# sourceMappingURL=run-in-parallel.js.map