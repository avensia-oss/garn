import * as minimist from 'minimist';
import * as log from './logging.mjs';

export const argv = minimist.default(process.argv.slice(2), {
  '--': true,
});

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
  /**
   * The asap flag is an optional hint from the person or process executing garn that she or he is willing to accept
   * trade-offs for speed. If you're writing a task that could be quicker you should check the value of this flag.
   * An example is if you have a task that starts by verifying something that seldom changes and needs to be verified
   * you should consider skipping that step if the asap flag is set.
   */
  asap: Flag<boolean>;
  /**
   * The parallel flag is an optional hint from the person or process executing garn that she or he wants to run
   * things as much in parallel as possible. If you're writing a task that can execute in multiple processes you
   * should consider doing so if this flag is set.
   */
  parallel: Flag<boolean>;
  /** Indicates the the command was executed from a ci/cd pipline
   * which can be used to add specific behavious to the build and pack commands**/
  buildServer: Flag<boolean>;
};

export const flags: Flags = {
  mode: registerFlag<'production' | 'development', 'development'>('mode', 'string', 'development', [
    'production',
    'development',
  ]),
  noPrompt: registerFlag<boolean>('no-prompt', 'boolean', () => !!process.env['TEAMCITY_VERSION']), // TODO: Detect other build servers as well
  buildServer: registerFlag<boolean>('build-server', 'boolean', () => !!process.env['TEAMCITY_VERSION']), // TODO: Detect other build servers as well
  logLevel: registerFlag<log.LogLevel>('log-level', 'string', 'log', ['verbose', 'info', 'log', 'warn', 'error']),
  version: registerFlag<string, undefined>('version', 'string', undefined),
  asap: registerFlag<boolean>('asap', 'boolean', false),
  parallel: registerFlag<boolean>('parallel', 'boolean', false),
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
      /**
       * In windows you can set foo-bar=baz as environment variable
       * This is not the case for *nix where valid env vars is only
       * accepting [a-zA-Z_]{1,}[a-zA-Z0-9_]*
       *
       * So we convert the name from foo-bar to FOO_BAR.
       */
      const nameAsValidPosixStringUpperCase = name.toUpperCase().replace(/-/g, '_');
      // In some recommendations they suggest using lowercase for representing application variables.
      // So we support that as well, `foo_bar`.
      const nameAsValidPosixStringLowerCase = name.toLowerCase().replace(/-/g, '_');
      // Keep it backward compatible by grabbing `foo-bar` if it exists. Else try `FOO_BAR`
      const envValue =
        process.env[name] ||
        process.env[nameAsValidPosixStringLowerCase] ||
        process.env[nameAsValidPosixStringUpperCase];
      const explicitDefaultValueIsExplicitlyUndefined = explicitDefaultValue === undefined && arguments.length >= 1;

      if (currentValueSet) {
        return currentValue;
      }
      const workspace = await import('./workspace.mjs');
      const currentWorkspace = workspace.current();

      let value: TValue | TDefaultValue | undefined;
      if (currentWorkspace && process.env[currentWorkspace.name + '-' + name]) {
        value = valueOf(process.env[currentWorkspace.name + '-' + name]!, type);
      } else if (envValue) {
        value = valueOf(envValue!, type);
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

  return flag;
}

export const taskName = argv._[0] || 'default';

export async function getChildArgs() {
  const args: Array<[string, string?]> = [];
  args.push(['--child-garn']);
  for (const flag of Object.keys(flags)) {
    const value = await flags[flag].get();
    if (value !== flags[flag].defaultValue) {
      const flagName = '--' + flags[flag].name;
      let val = value === true ? undefined : value;

      if (/^--no-.+/.test(flagName) && val === false) {
        val = undefined;
      }

      args.push([flagName, val]);
    }
  }
  return args;
}

function valueOf(valueString: string, type: FlagType): any {
  if (type === 'boolean') {
    return (['y', 'yes', 't', 'true', 'on'].indexOf(valueString.toLowerCase()) !== -1) as unknown;
  } else if (type === 'number') {
    return Number(valueString.replace(',', '.').replace(/[^0-9\.]+/, '')) as unknown;
  }
  return valueString;
}

function isPromise(x: unknown): x is Promise<any> {
  const p = x as Promise<any>;
  return p && !!p.catch && !!p.then;
}
