import { flags } from './cli-args';

export type LogLevel = 'verbose' | 'info' | 'log' | 'warn' | 'error';

export const logLevels = {
  verbose: 0,
  info: 1,
  log: 2,
  warn: 3,
  error: 4,
};

let printedErrors: Error[] = [];

async function logInternal(logger: any, level: number, messages: any[]) {
  const currentLevel = (logLevels as any)[await flags.logLevel.get()];

  const errorsInMessages: Error[] = messages.filter(m => m instanceof Error);
  const allErrorsAlreadyPrinted =
    errorsInMessages.length && errorsInMessages.every(e => printedErrors.indexOf(e) !== -1);
  if (allErrorsAlreadyPrinted && currentLevel !== logLevels.verbose) {
    return;
  }

  if (currentLevel <= level) {
    // eslint-disable-next-line eqeqeq
    if (!(level === logLevels.verbose || currentLevel == logLevels.verbose)) {
      // We don't want call stacks unless it's a verbose log
      messages = messages.map(m => (m instanceof Error ? String(m) : m));
    }
    printedErrors = printedErrors.concat(errorsInMessages);
    logger.apply(console, messages);
  }
}

export function verbose(...messages: any[]) {
  return logInternal(console.info, logLevels.verbose, ['[verbose]', ...messages]);
}

export function info(...messages: any[]) {
  return logInternal(console.log, logLevels.info, ['[info]', ...messages]);
}

export function log(...messages: any[]) {
  return logInternal(console.log, logLevels.log, messages);
}

export function warn(...messages: any[]) {
  return logInternal(console.warn, logLevels.warn, ['\x1b[33m%s\x1b[0m', '[WARNING]', ...messages]);
}

export function error(...messages: any[]) {
  return logInternal(console.error, logLevels.error, ['\x1b[31m%s\x1b[0m', '[ERROR!]', ...messages]);
}

export async function errorAndThrow(...messages: any[]): Promise<never> {
  await logInternal(console.error, logLevels.error, messages);
  const err = new Error(messages.join(' '));
  printedErrors.push(err);
  throw err;
}
