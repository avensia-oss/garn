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
exports.errorAndThrow = exports.error = exports.warn = exports.log = exports.info = exports.verbose = exports.logLevels = void 0;
const cli_args_1 = require("./cli-args");
exports.logLevels = {
    verbose: 0,
    info: 1,
    log: 2,
    warn: 3,
    error: 4,
};
let printedErrors = [];
function logInternal(logger, level, messages) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentLevel = exports.logLevels[yield cli_args_1.flags.logLevel.get()];
        const errorsInMessages = messages.filter(m => m instanceof Error);
        const allErrorsAlreadyPrinted = errorsInMessages.length && errorsInMessages.every(e => printedErrors.indexOf(e) !== -1);
        if (allErrorsAlreadyPrinted && currentLevel !== exports.logLevels.verbose) {
            return;
        }
        if (currentLevel <= level) {
            // eslint-disable-next-line eqeqeq
            if (!(level === exports.logLevels.verbose || currentLevel == exports.logLevels.verbose)) {
                // We don't want call stacks unless it's a verbose log
                messages = messages.map(m => (m instanceof Error ? String(m) : m));
            }
            printedErrors = printedErrors.concat(errorsInMessages);
            logger.apply(console, messages);
        }
    });
}
function verbose(...messages) {
    return logInternal(console.info, exports.logLevels.verbose, ['[verbose]', ...messages]);
}
exports.verbose = verbose;
function info(...messages) {
    return logInternal(console.log, exports.logLevels.info, ['[info]', ...messages]);
}
exports.info = info;
function log(...messages) {
    return logInternal(console.log, exports.logLevels.log, messages);
}
exports.log = log;
function warn(...messages) {
    return logInternal(console.warn, exports.logLevels.warn, ['\x1b[33m%s\x1b[0m', '[WARNING]', ...messages]);
}
exports.warn = warn;
function error(...messages) {
    return logInternal(console.error, exports.logLevels.error, ['\x1b[31m%s\x1b[0m', '[ERROR!]', ...messages]);
}
exports.error = error;
function errorAndThrow(...messages) {
    return __awaiter(this, void 0, void 0, function* () {
        yield logInternal(console.error, exports.logLevels.error, messages);
        const err = new Error(messages.join(' '));
        printedErrors.push(err);
        throw err;
    });
}
exports.errorAndThrow = errorAndThrow;
//# sourceMappingURL=logging.js.map