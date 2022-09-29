import * as minimist from 'minimist';
import * as log from './logging';
export declare const argv: minimist.ParsedArgs;
export declare const buildsystemPathArgName = "buildsystem-path";
export declare const buildsystemPath: any;
export declare const testMode: boolean;
export declare type FlagType = 'string' | 'number' | 'boolean';
export declare type Flag<TValue, TDefaultValue = TValue> = {
    name: string;
    type: FlagType;
    defaultValue?: TDefaultValue | (() => TDefaultValue | Promise<TDefaultValue>);
    possibleValues?: (TValue | TDefaultValue)[];
    get(defaultValue: TDefaultValue): Promise<TValue | TDefaultValue>;
    get(): Promise<TValue | TDefaultValue>;
    set: (value: TValue) => unknown;
};
export declare type Flags = {
    [name: string]: Flag<any, any>;
} & {
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
export declare const flags: Flags;
export declare function registerFlag<TValue, TDefaultValue = TValue>(name: string, type: FlagType, defaultValue?: TDefaultValue | (() => TDefaultValue | Promise<TDefaultValue>), possibleValues?: (TValue | TDefaultValue)[]): Flag<TValue, TDefaultValue>;
export declare const taskName: string;
export declare function getChildArgs(): Promise<[string, (string | undefined)?][]>;
