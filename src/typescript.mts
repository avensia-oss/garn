import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { getProjectPath } from './index.mts';
import { spawn } from './exec.mjs';

export async function typecheck(tsConfigPath: string) {
  const ts = await import('typescript');
  const basePath = path.dirname(tsConfigPath);
  const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
  console.log('tsConfig', tsConfigPath);
  const parsed = ts.parseJsonConfigFileContent(tsConfig, ts.sys, path.dirname(tsConfigPath));
  parsed.options.noEmit = true;
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const emitResult = program.emit();
  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

  const errors: string[] = [];

  allDiagnostics.forEach(diagnostic => {
    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      errors.push(
        chalk.green(
          path.relative(getProjectPath(), diagnostic.file.fileName) + '(' + line + 1 + ',' + character + 1 + '):',
        ) +
          ' ' +
          message,
      );
    } else {
      errors.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  });

  return {
    hasErrors: !!errors.length,
    errors,
  };
}
