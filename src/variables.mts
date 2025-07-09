import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import * as cliArgs from './cli-args.mjs';
import * as log from './logging.mjs';
import { getProjectRoot } from './workspace.mts';

export let envVariablesFile = path.join(getProjectRoot(), '.env');

// Use fs.readFileSync instead of require for ES modules
const packageJsonPath = path.join(getProjectRoot(), 'package.json');
let packageJson: any = {};
let explicitPathFromPackageJson: string | undefined = undefined;

try {
  if (fs.existsSync(packageJsonPath)) {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.envFile) {
      const envFilePath = path.normalize(path.join(getProjectRoot(), packageJson.envFile));
      explicitPathFromPackageJson = envFilePath;
      if (fs.existsSync(envFilePath)) {
        envVariablesFile = envFilePath;
      }
    }
  } else {
    console.warn(`Warning: package.json not found at ${packageJsonPath}. Using default .env file location.`);
  }
} catch (error) {
  console.warn(
    `Warning: Failed to read package.json at ${packageJsonPath}: ${error instanceof Error ? error.message : 'Unknown error'}. Using default .env file location.`,
  );
}

let tries = 0;
while (!fs.existsSync(envVariablesFile) && tries < 10) {
  envVariablesFile = path.join(path.dirname(envVariablesFile), '.env');
  tries++;
}

if (fs.existsSync(envVariablesFile)) {
  dotenv.config({ path: envVariablesFile });
} else if (explicitPathFromPackageJson) {
  envVariablesFile = explicitPathFromPackageJson;
  // Create an empty .env-file. This allows for child-garn instances to reach the same file before it has been written to.
  fs.closeSync(fs.openSync(envVariablesFile, 'w'));
  fs.chmodSync(envVariablesFile, '600');
}

const variables: { [name: string]: Variable<unknown, unknown> } = {};

type Variable<TValue, TDefaultValue> = {
  name: string;
  defaultValue: TDefaultValue | (() => Promise<TDefaultValue>);
  question: string;
  type: 'string' | 'boolean' | 'number';
  parser: (s: string) => TValue;
  validate: (s: string) => boolean | string;
};

export function createString(
  name: string,
  defaultValue: string | undefined | (() => Promise<string>),
  question: string,
  validation?: RegExp | undefined,
) {
  return create<string, string>({
    name,
    defaultValue,
    question,
    type: 'string',
    parser: s => s,
    validate: s => (validation ? (validation.test(s) ? true : `The value must match the regex ${validation}`) : true),
  });
}

export function createNumber(
  name: string,
  defaultValue: number | undefined | (() => Promise<number>),
  question: string,
  validation?: RegExp | undefined,
) {
  return create<number, number | undefined>({
    name,
    defaultValue,
    question,
    type: 'number',
    parser: s => Number(s),
    validate: s =>
      validation ? (validation.test(s) ? true : `The value must match the regex ${validation}`) : !isNaN(Number(s)),
  });
}

export function createBoolean(name: string, defaultValue: boolean | (() => Promise<boolean>), question: string) {
  return create<boolean, boolean>({
    name,
    defaultValue,
    question,
    type: 'number',
    parser: s => parseBoolean(s)!,
    validate: s => parseBoolean(s) !== undefined,
  });
}

function parseBoolean(s: string) {
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

export async function promptForAllValues() {
  if (await cliArgs.flags.noPrompt.get()) {
    return;
  }
  const questions: any[] = [];
  for (const variableName in variables) {
    const variable = variables[variableName];
    questions.push({
      name: variable.name,
      type: variable.type === 'boolean' ? 'confirm' : 'input',
      message: variable.question,
      default: variable.defaultValue instanceof Function ? await variable.defaultValue() : variable.defaultValue,
      validate: variable.validate,
    });
  }
  const answers: any = await inquirer.prompt(questions);
  for (const variableName of Object.keys(answers)) {
    process.env[variableName] = answers[variableName] as string;
    saveEnvVariable(variableName, answers[variableName]);
  }
}

export function saveEnvVariable(name: string, value: any) {
  if (!(typeof value === 'string')) {
    value = JSON.stringify(value);
  }
  let content: string[] = [];
  if (fs.existsSync(envVariablesFile)) {
    content = fs
      .readFileSync(envVariablesFile)
      .toString()
      .split('\n')
      .map(s => s.trim());
    content = content.filter(line => {
      return !line.startsWith(`${name}=`);
    });
  }
  content.push(`${name}=${value}`);
  fs.writeFileSync(envVariablesFile, content.join('\n').trim());
}

function create<TValue, TDefaultValue>(config: Variable<TValue, TDefaultValue | undefined>) {
  variables[config.name] = config;

  return {
    name: config.name,
    async get(): Promise<TValue | TDefaultValue> {
      let value: TValue | TDefaultValue;
      let valueString = process.env[config.name];
      if (valueString === undefined) {
        valueString = cliArgs.argv[config.name];
      }
      if (valueString === undefined) {
        if (await cliArgs.flags.noPrompt.get()) {
          const defaultValue =
            config.defaultValue instanceof Function ? await config.defaultValue() : config.defaultValue;
          if (defaultValue === undefined) {
            throw new Error(`Unable to get a value for the variable name '${config.name}'`);
          }
          value = defaultValue;
        } else {
          const answer: any = await inquirer.prompt({
            name: config.name,
            type: 'input',
            message: config.question,
            default: (() => {
              if (typeof config.defaultValue === 'function') {
                return async () => {
                  const result = await (config.defaultValue as () => Promise<TDefaultValue>)();
                  return result !== undefined ? String(result) : undefined;
                };
              } else {
                return config.defaultValue !== undefined ? String(config.defaultValue) : undefined;
              }
            })(),
            validate: config.validate,
          });
          value = config.parser(answer[config.name] as string);
          log.log(`Saving your answer in ${envVariablesFile} so we don't have to bother you again...`);
          saveEnvVariable(config.name, value);
        }
      } else {
        value = config.parser(valueString);
      }

      return value;
    },
  };
}
