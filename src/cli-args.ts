import * as minimist from 'minimist';
import * as log from './logging';

export const argv = minimist(process.argv.slice(2), {
  '--': true,
});

export const buildsystemPathArgName = 'buildsystem-path';
export const buildsystemPath = argv[buildsystemPathArgName];

export const testMode = 'test-mode' in argv;

export type FlagType = 'string' | 'number' | 'boolean';
export type Flag<TValue, TDefaultValue = TValue> = {
  name: string;
  type: FlagType;
  defaultValue?: TDefaultValue | (() => TDefaultValue | Promise<TDefaultValue>);
  possibleValues?: (TValue | TDefaultValue)[];
  get(defaultValue: TDefaultValue): Promise<TValue | TDefaultValue>;
  get(): Promise<TValue | TDefaultValue>;
  set: (value: TValue) => unknown;
};

export type Flags = { [name: string]: Flag<any, any> } & {
  mode: Flag<'production' | 'development', 'development'>;
  noPrompt: Flag<boolean>;
  logLevel: Flag<log.LogLevel>;
  version: Flag<string, undefined>;
  asap: Flag<boolean>;
};

export const flags: Flags = {
  mode: registerFlag<'production' | 'development', 'development'>('mode', 'string', 'development', [
    'production',
    'development',
  ]),
  noPrompt: registerFlag<boolean>('no-prompt', 'boolean', () => !!process.env['TEAMCITY_VERSION']), // TODO: Detect other build servers as well
  logLevel: registerFlag<log.LogLevel>('log-level', 'string', 'log', ['verbose', 'info', 'log', 'warn', 'error']),
  version: registerFlag<string, undefined>('version', 'string', undefined),
  asap: registerFlag<boolean>('asap', 'boolean', false),
};

export function registerFlag<TValue, TDefaultValue = TValue>(
  name: string,
  type: FlagType,
  defaultValue?: TDefaultValue | (() => TDefaultValue | Promise<TDefaultValue>),
  possibleValues?: (TValue | TDefaultValue)[],
) {
  const hasUndefinedAsExplicitDefault = defaultValue === undefined && arguments.length >= 3;

  let currentValue: TValue;
  let currentValueSet = false;
  const flag: Flag<TValue, TDefaultValue> = {
    name,
    type,
    defaultValue,
    possibleValues,
    get: async (explicitDefaultValue?: TDefaultValue) => {
      const explicitDefaultValueIsExplicitlyUndefined = explicitDefaultValue === undefined && arguments.length >= 1;

      if (currentValueSet) {
        return currentValue;
      }
      const workspace = await import('./workspace');
      const currentWorkspace = workspace.current();
      let value: TValue | TDefaultValue | undefined;
      if (currentWorkspace && process.env[currentWorkspace.name + '-' + name]) {
        value = valueOf(process.env[currentWorkspace.name + '-' + name]!, type);
      } else if (process.env[name]) {
        value = valueOf(process.env[name]!, type);
      } else if (defaultValue !== undefined || hasUndefinedAsExplicitDefault) {
        value = typeof defaultValue === 'function' ? (defaultValue as () => TDefaultValue)() : defaultValue;
        if (isPromise(value)) {
          value = await value;
        }
      }
      if (name in argv) {
        const valueString = String(argv[name]);
        value = valueOf(valueString, type);
      }
      if (currentWorkspace && currentWorkspace.name + '-' + name in argv) {
        const valueString = String(argv[currentWorkspace.name + '-' + name]);
        value = valueOf(valueString, type);
      }
      if (value === undefined && defaultValue === undefined && !hasUndefinedAsExplicitDefault) {
        if (explicitDefaultValue !== undefined || explicitDefaultValueIsExplicitlyUndefined) {
          return explicitDefaultValue as TDefaultValue;
        }
        throw new Error(`Cannot find a value for the flag '${name}'`);
      }
      return value as TValue | TDefaultValue;
    },
    set: (value: TValue) => {
      currentValue = value;
      currentValueSet = true;
    },
  };

  if (flags) {
    flags[name] = flag;
  }
  return flag;
}

export const taskName = argv._[0] || 'default';

export async function getChildArgs() {
  const args: Array<[string, string?]> = [];
  args.push(['--child-garn']);
  if ('compile-buildsystem' in argv) {
    args.push(['--compile-buildsystem']);
  }
  for (const flag of Object.keys(flags)) {
    const value = await flags[flag].get();
    if (value !== flags[flag].defaultValue) {
      args.push(['--' + flags[flag].name, value === true ? undefined : value]);
    }
  }
  return args;
}

function valueOf(valueString: string, type: FlagType): any {
  if (type === 'boolean') {
    return (['y', 'yes', 't', 'true'].indexOf(valueString.toLowerCase()) !== -1) as unknown;
  } else if (type === 'number') {
    return Number(valueString.replace(',', '.').replace(/[^0-9\.]+/, '')) as unknown;
  }
  return valueString;
}

function isPromise(x: unknown): x is Promise<any> {
  const p = x as Promise<any>;
  return p && !!p.catch && !!p.then;
}
