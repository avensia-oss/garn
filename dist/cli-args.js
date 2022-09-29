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
exports.getChildArgs = exports.taskName = exports.registerFlag = exports.flags = exports.testMode = exports.buildsystemPath = exports.buildsystemPathArgName = exports.argv = void 0;
const minimist = require("minimist");
exports.argv = minimist(process.argv.slice(2), {
    '--': true,
});
exports.buildsystemPathArgName = 'buildsystem-path';
exports.buildsystemPath = exports.argv[exports.buildsystemPathArgName];
exports.testMode = 'test-mode' in exports.argv;
exports.flags = {
    mode: registerFlag('mode', 'string', 'development', [
        'production',
        'development',
    ]),
    noPrompt: registerFlag('no-prompt', 'boolean', () => !!process.env['TEAMCITY_VERSION']),
    buildServer: registerFlag('build-server', 'boolean', () => !!process.env['TEAMCITY_VERSION']),
    logLevel: registerFlag('log-level', 'string', 'log', ['verbose', 'info', 'log', 'warn', 'error']),
    version: registerFlag('version', 'string', undefined),
    asap: registerFlag('asap', 'boolean', false),
    parallel: registerFlag('parallel', 'boolean', false),
};
function registerFlag(name, type, defaultValue, possibleValues) {
    const hasUndefinedAsExplicitDefault = defaultValue === undefined && arguments.length >= 3;
    let currentValue;
    let currentValueSet = false;
    const flag = {
        name,
        type,
        defaultValue,
        possibleValues,
        get: (explicitDefaultValue) => __awaiter(this, arguments, void 0, function* () {
            const explicitDefaultValueIsExplicitlyUndefined = explicitDefaultValue === undefined && arguments.length >= 1;
            if (currentValueSet) {
                return currentValue;
            }
            const workspace = yield Promise.resolve().then(() => require('./workspace'));
            const currentWorkspace = workspace.current();
            let value;
            if (currentWorkspace && process.env[currentWorkspace.name + '-' + name]) {
                value = valueOf(process.env[currentWorkspace.name + '-' + name], type);
            }
            else if (process.env[name]) {
                value = valueOf(process.env[name], type);
            }
            else if (defaultValue !== undefined || hasUndefinedAsExplicitDefault) {
                value = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
                if (isPromise(value)) {
                    value = yield value;
                }
            }
            if (name in exports.argv) {
                const valueString = String(exports.argv[name]);
                value = valueOf(valueString, type);
            }
            if (currentWorkspace && currentWorkspace.name + '-' + name in exports.argv) {
                const valueString = String(exports.argv[currentWorkspace.name + '-' + name]);
                value = valueOf(valueString, type);
            }
            if (value === undefined && defaultValue === undefined && !hasUndefinedAsExplicitDefault) {
                if (explicitDefaultValue !== undefined || explicitDefaultValueIsExplicitlyUndefined) {
                    return explicitDefaultValue;
                }
                throw new Error(`Cannot find a value for the flag '${name}'`);
            }
            return value;
        }),
        set: (value) => {
            currentValue = value;
            currentValueSet = true;
        },
    };
    if (exports.flags) {
        exports.flags[name] = flag;
    }
    return flag;
}
exports.registerFlag = registerFlag;
exports.taskName = exports.argv._[0] || 'default';
function getChildArgs() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = [];
        args.push(['--child-garn']);
        if ('compile-buildsystem' in exports.argv) {
            args.push(['--compile-buildsystem']);
        }
        for (const flag of Object.keys(exports.flags)) {
            const value = yield exports.flags[flag].get();
            if (value !== exports.flags[flag].defaultValue) {
                args.push(['--' + exports.flags[flag].name, value === true ? undefined : value]);
            }
        }
        return args;
    });
}
exports.getChildArgs = getChildArgs;
function valueOf(valueString, type) {
    if (type === 'boolean') {
        return (['y', 'yes', 't', 'true', 'on'].indexOf(valueString.toLowerCase()) !== -1);
    }
    else if (type === 'number') {
        return Number(valueString.replace(',', '.').replace(/[^0-9\.]+/, ''));
    }
    return valueString;
}
function isPromise(x) {
    const p = x;
    return p && !!p.catch && !!p.then;
}
//# sourceMappingURL=cli-args.js.map