import * as path from 'path';
import * as chalk from 'chalk';
import { projectPath } from '.';

export async function typecheck(tsConfigPath: string) {
  const ts = await import('typescript');
  const basePath = path.dirname(tsConfigPath);
  const tsConfig = require(tsConfigPath);
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
          path.relative(projectPath, diagnostic.file.fileName) + '(' + line + 1 + ',' + character + 1 + '):',
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
