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
exports.saveEnvVariable = exports.promptForAllValues = exports.createBoolean = exports.createNumber = exports.createString = exports.envVariablesFile = void 0;
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const cliArgs = require("./cli-args");
const log = require("./logging");
exports.envVariablesFile = path.join(cliArgs.buildsystemPath, '..', '.env');
const packageJson = require(path.join(cliArgs.buildsystemPath, '..', 'package.json'));
let explicitPathFromPackageJson = undefined;
if (packageJson.envFile) {
    const envFilePath = path.normalize(path.join(cliArgs.buildsystemPath, '..', packageJson.envFile));
    explicitPathFromPackageJson = envFilePath;
    if (fs.existsSync(envFilePath)) {
        exports.envVariablesFile = envFilePath;
    }
}
let tries = 0;
while (!fs.existsSync(exports.envVariablesFile) && tries < 10) {
    exports.envVariablesFile = path.join(path.dirname(exports.envVariablesFile), '..', '.env');
    tries++;
}
if (fs.existsSync(exports.envVariablesFile)) {
    dotenv.config({ path: exports.envVariablesFile });
}
else if (explicitPathFromPackageJson) {
    exports.envVariablesFile = explicitPathFromPackageJson;
}
const variables = {};
function createString(name, defaultValue, question, validation) {
    return create({
        name,
        defaultValue,
        question,
        type: 'string',
        parser: s => s,
        validate: s => (validation ? (validation.test(s) ? true : `The value must match the regex ${validation}`) : true),
    });
}
exports.createString = createString;
function createNumber(name, defaultValue, question, validation) {
    return create({
        name,
        defaultValue,
        question,
        type: 'number',
        parser: s => Number(s),
        validate: s => validation ? (validation.test(s) ? true : `The value must match the regex ${validation}`) : !isNaN(Number(s)),
    });
}
exports.createNumber = createNumber;
function createBoolean(name, defaultValue, question) {
    return create({
        name,
        defaultValue,
        question,
        type: 'number',
        parser: s => parseBoolean(s),
        validate: s => parseBoolean(s) !== undefined,
    });
}
exports.createBoolean = createBoolean;
function parseBoolean(s) {
    if (!s) {
        return undefined;
    }
    s = s.toLowerCase();
    // eslint-disable-next-line eqeqeq
    if (s === 'true' || s === 'yes' || s == 't' || s === 'y') {
        return true;
    }
    // eslint-disable-next-line eqeqeq
    if (s === 'false' || s === 'no' || s == 'f' || s === 'n') {
        return false;
    }
    return undefined;
}
function promptForAllValues() {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield cliArgs.flags.noPrompt.get()) {
            return;
        }
        const questions = [];
        for (const variableName in variables) {
            const variable = variables[variableName];
            questions.push({
                name: variable.name,
                type: variable.type === 'boolean' ? 'confirm' : 'input',
                message: variable.question,
                default: variable.defaultValue instanceof Function ? yield variable.defaultValue() : variable.defaultValue,
                validate: variable.validate,
            });
        }
        const answers = yield inquirer.prompt(questions);
        for (const variableName of Object.keys(answers)) {
            process.env[variableName] = answers[variableName];
            saveEnvVariable(variableName, answers[variableName]);
        }
    });
}
exports.promptForAllValues = promptForAllValues;
function saveEnvVariable(name, value) {
    if (!(typeof value === 'string')) {
        value = JSON.stringify(value);
    }
    let content = [];
    if (fs.existsSync(exports.envVariablesFile)) {
        content = fs
            .readFileSync(exports.envVariablesFile)
            .toString()
            .split('\n')
            .map(s => s.trim());
        content = content.filter(line => {
            return !line.startsWith(`${name}=`);
        });
    }
    content.push(`${name}=${value}`);
    fs.writeFileSync(exports.envVariablesFile, content.join('\n').trim());
}
exports.saveEnvVariable = saveEnvVariable;
function create(config) {
    variables[config.name] = config;
    return {
        name: config.name,
        get() {
            return __awaiter(this, void 0, void 0, function* () {
                let value;
                let valueString = process.env[config.name];
                if (valueString === undefined) {
                    valueString = cliArgs.argv[config.name];
                }
                if (valueString === undefined) {
                    if (yield cliArgs.flags.noPrompt.get()) {
                        const defaultValue = config.defaultValue instanceof Function ? yield config.defaultValue() : config.defaultValue;
                        if (defaultValue === undefined) {
                            throw new Error(`Unable to get a value for the variable name '${config.name}'`);
                        }
                        value = defaultValue;
                    }
                    else {
                        const answer = yield inquirer.prompt({
                            name: config.name,
                            type: 'input',
                            message: config.question,
                            default: config.defaultValue,
                            validate: config.validate,
                        });
                        value = config.parser(answer[config.name]);
                        log.log(`Saving your answer in ${exports.envVariablesFile} so we don't have to bother you again...`);
                        saveEnvVariable(config.name, value);
                    }
                }
                else {
                    value = config.parser(valueString);
                }
                return value;
            });
        },
    };
}
//# sourceMappingURL=variables.js.map