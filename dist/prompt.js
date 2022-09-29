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
exports.selectOptions = exports.selectOption = exports.answersYes = exports.question = void 0;
const inquirer = require("inquirer");
const cli_args_1 = require("./cli-args");
function question(q, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield cli_args_1.flags.noPrompt.get()) {
            return '';
        }
        const answer = yield inquirer.prompt({
            name: 'question',
            type: 'input',
            message: q,
            validate: input => {
                if (!(options === null || options === void 0 ? void 0 : options.pattern)) {
                    return true;
                }
                return options.pattern.test(input);
            },
        });
        return answer['question'];
    });
}
exports.question = question;
function answersYes(q) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield cli_args_1.flags.noPrompt.get()) {
            return false;
        }
        const answer = yield inquirer.prompt({
            name: 'question',
            type: 'confirm',
            message: q,
        });
        return answer['question'];
    });
}
exports.answersYes = answersYes;
function selectOption(q, options, defaultValue) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield cli_args_1.flags.noPrompt.get()) {
            throw new Error(`Can't call prompt.selectOption() when running on a CI server or with the --no-prompt flag`);
        }
        const answer = yield inquirer.prompt({
            name: 'question',
            type: 'list',
            choices: options,
            message: q,
            default: defaultValue,
        });
        return answer['question'];
    });
}
exports.selectOption = selectOption;
function selectOptions(q, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield cli_args_1.flags.noPrompt.get()) {
            throw new Error(`Can't call prompt.selectOptions() when running on a CI server or with the --no-prompt flag`);
        }
        const answer = yield inquirer.prompt({
            name: 'question',
            type: 'checkbox',
            choices: options,
            message: q,
        });
        return answer['question'];
    });
}
exports.selectOptions = selectOptions;
//# sourceMappingURL=prompt.js.map