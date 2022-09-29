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
exports.typecheck = void 0;
const path = require("path");
const chalk = require("chalk");
const _1 = require(".");
function typecheck(tsConfigPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const ts = yield Promise.resolve().then(() => require('typescript'));
        const basePath = path.dirname(tsConfigPath);
        const tsConfig = require(tsConfigPath);
        const parsed = ts.parseJsonConfigFileContent(tsConfig, ts.sys, path.dirname(tsConfigPath));
        parsed.options.noEmit = true;
        const program = ts.createProgram(parsed.fileNames, parsed.options);
        const emitResult = program.emit();
        const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
        const errors = [];
        allDiagnostics.forEach(diagnostic => {
            if (diagnostic.file && diagnostic.start !== undefined) {
                const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                errors.push(chalk.green(path.relative(_1.projectPath, diagnostic.file.fileName) + '(' + line + 1 + ',' + character + 1 + '):') +
                    ' ' +
                    message);
            }
            else {
                errors.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
            }
        });
        return {
            hasErrors: !!errors.length,
            errors,
        };
    });
}
exports.typecheck = typecheck;
//# sourceMappingURL=typescript.js.map